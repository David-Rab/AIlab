# Corporate structure, partners and lab kinds

Status: designer's decisions taken 2026-11-28; ready to cut into tasks. Branch `corp` is rebased onto master 7ce0ad7e,
with the outside world merged.

Inputs:
- [DEALS-AUDIT.md](DEALS-AUDIT.md) (20 findings, with the engine's own offers at the fixtures);
- the code inventory (§10);
- research/15 §1.6–1.7, research/18, FINANCE-V3 §6–§7 and §13;
- world/usgov.ts.

## 0. The idea in one paragraph

A company is a set of **holders**. Each has shares and wants something. **Board seats follow voting power**: shares ×
the share class's votes. A few **seat powers** come from the charter, for example a mission body's vetoes or its right
to appoint seats. Nothing is pre-defined beyond that. **Control is emergent**: a holder controls the company only if its
seats are a majority of the board. Many companies have no controller, and the board then runs by vote. If a controller
does emerge, its kind changes how the company works:
- a corporate owner or the government funds you through a budget and sets yearly goals;
- a mission body's seats carry its vetoes.

The structure (founder-led, mission-controlled, division, government-controlled, public, board-run) is only a **label**
for the result. You lose control in three ways:
- you are **ousted**;
- the company goes **bankrupt**;
- **another lab is now in control.** Either it bought you, or a parent or the government folded you into its leading lab
  because you weren't the leader.

## 1. Designer's decisions (2026-11-28)

1. **Three separate things:** holders (structure and ties), position (what you start with), and lab kind (a bundle of
   both, plus Custom).
2. **Seats by holders' votes,** with a few seat powers. **The controller is emergent;** some companies have none.
3. **Losses:** ousted, bankrupt, or another *lab* in control. A non-lab owner taking control (a cloud partner, the
   government while you lead) is a change, not an end.
4. **The soft path (the Defense Production Act):** if you lead, you stay as you are. You get part of the other US labs'
   compute and staff, and government directors join your board. **Only the hard path nationalizes.**
5. **Government control** works like a division with very different goals, **budget included**.
6. **Rival labs stay simple.**
7. **Positions are five:**
   - three difficulties: frontier, contender, from scratch;
   - two trade-offs at about contender difficulty: capital-heavy (with a large user base and products) and talent
     breakaway.
8. **Accepted:**
   - no exit from mission control;
   - one owner-funded model for parents and the government;
   - the big-tech parent is the partner Azimuth;
   - the revenue share becomes distribution;
   - partners act (renewals, follow-ons);
   - Corvid, anchoring and "one lab per partner" are removed;
   - **sovereigns are dropped** (sites abroad logged in OPEN.md).

## 2. Holders, share classes and seat powers

Stored state:
- the **cap table**: today's `ownership`, plus the government on the hard path;
- the **charter**: a few flags changed only by named decisions (`missionBody`, `profitCap`, `dualClass`, `listed`).

Everything else is derived.

### 2.1 Holders and their votes

| Holder | Votes per share | Seat kind | What its seats weigh most (today's MOOD_WEIGHTS) | Gives |
|---|---|---|---|---|
| **Founders** | 1; **×10 with dual-class** | founder (the CEO's seat always votes yes) | — | The CEO |
| **Investors** | 1 | financial | promise results ×1.5, falling behind ×1.5 | Rounds |
| **Partners** (Northwind, Azimuth, Silica) | **0** at or under their 15% cap (sourced Class N); 1 above it (only after a rescue or merger, §5.5) | strategic | per its interest (§5.1) | Equity, supply, distribution |
| **Public** | 1 (or the lower vote under dual-class) | independent | setbacks ×1.5 | The public pool, bonds |
| **Mission body** | its stake's votes, **plus the right to appoint seats** (§2.2) | mission | incidents ×2 | Credibility |
| **Government** | no shares on the soft path (it appoints directors, §4.2); the owner on the hard path | gov (the kind exists in the code but is never created) | incidents ×1.5, security | Compute and staff (soft path); budget and compute (hard path) |

### 2.2 The board

- **7 seats.** The CEO holds one.
- **Appointed seats come first.** These are the charter's seat powers:
  - **Mission body:** appoints 4. OpenAI's foundation appoints all of the PBC's directors; Anthropic's trust elects a
    majority. Four of seven is the in-game version [D].
  - **Government directors on the soft path:** 2, *on top of* the 7.
  - **Critics' seat:** as today, on top, up to 9 in all.
- **The rest go by voting power,** largest remainder first, among holders with votes. A holder too small for a seat gets
  none.
- Seats are recomputed whenever a round, deal, IPO, rescue, merger or change of control closes. Every preview shows the
  board afterwards.

This one function, `boardOf(cap table, charter)`, replaces initialBoard's presets, syncFinancialSeats, startBoard's
extra investor, the listing seat and the rescue's addSeat.

### 2.3 Seat powers (vetoes) and the override

Seat powers come from the charter and belong to a seat kind:

| Power | Held by | Over |
|---|---|---|
| **Mission veto** (can't be forced) | mission seats, voting as a body | any holder passing 50%; handing out a capability-threshold model; releasing a red-flagged model (the safety committee) |
| **Security veto** (can't be forced) | gov seats, voting as a body | handing out a capability-threshold model; a foreign or competitor holder gaining votes |
| **Override** | any holder with **more than half of the shareholder votes** (it could replace the board) | forcing a decision the board voted down, at −20 confidence |

The override is today's "founder control", now emergent. Founders with dual-class or with most of the shares have it. A
corporate owner above 50% has it too, but it holds the seats anyway.

### 2.4 Investor appeal

Today's flat table GOV_FACTOR becomes a product of charter features: profit cap ×0.67, mission body ×0.9, dual-class
×0.95, otherwise 1.0.

## 3. Control is emergent

### 3.1 Who controls

The **controller** is the holder whose seats are more than half of the board's voting seats. If there's no such holder,
there's no controller and the board runs by vote. That's normal: a widely held public company, or a private lab after
several raises.

The **label** shown on the Board card is read off the result:

| Result | Label |
|---|---|
| Government holds the majority | Government-controlled |
| One company holds the majority | Division of {owner} |
| Mission seats hold the majority | Mission-controlled |
| Founders hold the majority (seats or override) | Founder-led |
| No controller, listed | Public company |
| No controller, private | Board-run |

No rule reads the label. Rules read the seats, the powers and the controller's kind.

### 3.2 What a controller's kind changes

| Controller | Money | Goals the board judges |
|---|---|---|
| **None, founders, mission body** | Markets: rounds, debt, partner deals (and the public pool and bonds when listed) | Promises from your raises (FIN2) |
| **A company (parent)** | **Owner budget**: none of your own | The parent's yearly goals: capability, scale, adoption (today's) |
| **The government** | **Owner budget** + pooled compute | The government's yearly goals: security level, lead over China, no serious incident |

- **One confidence meter:** board confidence, with its causes weighted by who sits on the board, as today. A
  division's "parent confidence" is this same meter.
- **Owner budget** (finance/parent.ts): the owner's plan × min(1, 0.5 + confidence ÷ 120).
  - A parent from the start uses today's plan.
  - An owner that took control mid-game takes your last four quarters of spending as year 0.
  - The government's plan grows on a national-project path, [D] until sourced.
- **Owner-funded companies** have no raises, debt, leases or partner deals of their own, and can't go bankrupt.
  Overspending costs confidence, as today.

### 3.3 Losing control

| Loss | When |
|---|---|
| **Ousted** | The ouster vote under **any** board: below 25 confidence after a 60-day warning, seat by seat (today's rule; the "a division can't be ousted" exception goes). A controller's seats usually decide it |
| **Bankrupt** | As today; market-funded companies only |
| **Another lab in control** | 1. A **lab** becomes the controller (a rival or the partner's lab buys you). 2. Your controller **owns another lab that leads you** and folds you into it: Azimuth's in-house lab, or the national project on the hard path when you're behind (the leading lab absorbs the others; Brain + DeepMind, 2023) |

A **non-lab** owner taking control is not a loss: Northwind or Silica after a rescue, or the government while you lead.
The same rule settles the Azimuth case. If Azimuth takes control and its own lab leads you, you're folded in. If you
lead, you are Azimuth's lab and play on as its division, and the NPC in-house lab merges into you.

The endings 'acquired' and 'nationalized' become cases of "another lab in control". The end text names the lab.

## 4. How control changes

Each change is a named action or event with a full preview, and the preview shows the board and controller afterwards.

| Change | How | Votes | Effect |
|---|---|---|---|
| **IPO** | `fin.ipo` (as today) | none | Public holders and their seats; dual-class keeps founders' votes |
| **Lift the profit cap** (was "recapitalise") | Action; about 4 quarters of Attorney General review, safety-staff morale −3 | none | The cap goes and the conditional tranche is paid; the mission body stays |
| **Dilution** | Every round and deal | as today | Seats move by votes. The preview says when a holder gains or loses the majority or the override |
| **A holder passes 50%** | Rescue, tranches, stock paid in a merger: **every** path is judged at the stake it will reach | Mission veto first, then the board | That holder's seats and powers; it may become the controller (§3.3) |
| **Soft path** (E22, §4.2) | You accept, as the frontier lab | none | Government directors join (2 seats), plus pooled compute and staff |
| **Hard path** (§4.3) | The government takes the lab | none | Leading: government-controlled. Behind: another lab in control (loss) |

**Not offered:** leaving mission control (state Attorney Generals stopped exactly this in May 2025), or spinning out of
an owner.

### 4.2 The soft path, as the lead lab

Today, accepting E22 pools 50% of each US rival lab's compute into you as free cloud capacity. New:
- the same share of their **staff** joins your teams [D];
- **2 government directors** join on top of the 7, with the security veto;
- nothing else changes: same holders, same money.

### 4.3 The hard path

The trigger is unchanged: low trust past the hold time at stage 3 or above, or the misalignment-leak scare.

- **You lead:** the government becomes the controlling holder.
  - It appoints the board majority. Other holders keep their shares and their remaining seats.
  - Confidence starts at 40, on probation: below the warning line, above the ouster line.
  - The government's budget and goals start at the next review.
- **You're behind:** you're folded into the national project under the leading lab. That's a loss.

## 5. Partners and deals

The audit's 20 findings are in DEALS-AUDIT.md §5. This is the design that answers them.

### 5.1 Cast and interests (NPC-simple)

Northwind (Microsoft-like cloud), Azimuth (Google/Amazon-like cloud with custom chips and an in-house lab), Silica
(Nvidia-like chips). Corvid and sovereigns go. Each partner has **one interest**, shown in player words. It moves the
partner's offers:

| Partner | Values you more when | Values you less when |
|---|---|---|
| A hyperscaler | You spend on its cloud; your models sell through it | Its own lab nears you (Azimuth); you lean on its competitor |
| Silica | You deploy its chips | You buy custom chips instead |

### 5.2 One deal shape: equity for a compute commitment in dollars

- The partner invests E. You commit to spend 4 × E (sourced 2–12×) on its supply over the deal. The commitment is in
  dollars, so the capacity it buys grows as prices fall. Custom chips are a supply option inside the same commitment.
- **Tranches** are paid "after $X of the commitment is spent". The gigawatt conditions and the $5B floor go.
- **Distribution replaces the 8% revenue share.** The partner resells your models to its cloud customers. That's a
  channel adding API and enterprise reach, and it takes a cut of that channel only, shown with a projection. The
  leader's legacy Northwind stake keeps its real all-revenue share, projected the same way.

### 5.3 Strings that cost something visible and end with the deal

- **Exclusivity:** no deals with the partner's competitor while the deal runs. The preview names the blocked competitor
  and what it would offer today.
- **IP access:** the partner's lab licenses your models while the deal runs. The preview gives the cost in lead ("its lab
  ends about 4 months closer"). The rate is [D] until sourced.

### 5.4 Partners act, rarely

- **When a deal ends**, the partner offers a renewal. The terms follow its interest and your **dependence** on it (the
  share of your compute it supplies).
- **Follow-on offers** appear as an action, not an event, when its interest is high.
- The limit counts **running** deals, one per partner.

### 5.5 Rescue, stakes and control

- **Rescue** is a distressed round with strings, on the same card as the down round. It comes from the partner that
  values you most, priced by your distress.
- **Partner stakes** are capped at 15% with no votes (antitrust, sourced). The only way past is a rescue or a merger,
  both judged at the stake they reach (§4).
- **The separate anchoring channel is removed.**
- **Rival labs** keep no partner mechanics. A rival card shows a backer label only.

### 5.6 Sovereigns are dropped

A sovereign was a cheque with no strings and, since the outside-world merge, no cost. The one real dynamic worth having,
Gulf money paired with **sites abroad**, is logged in design/OPEN.md (Data centres).

### 5.7 One home

- **A Partners card** in Finance has one row per partner: what it wants, what it gives, how much it values you, your
  dependence on it, and its running deal with the terms still to come. The rescue sits on the distress card.
- Every string's future cost is in the preview. The stake on the card is the number the votes use.
- The glossary is rewritten in player words.

## 6. Positions and lab kinds

### 6.1 Position: what you start with (no holders, no partners)

| Position | Difficulty | Compute | Cash | Staff | Model | Research | Stars | Users and products |
|---|---|---|---|---|---|---|---|---|
| **Frontier** | easiest | good | good | good | best | best | good | full |
| **Contender** | middle | less | less | less | months behind | less | some | some |
| **From scratch** | hardest | low | low | low | imported open weights | low | few | none |
| **Capital-heavy** | about contender | a lot | a lot | a lot | weak | weak | few | **large** |
| **Talent breakaway** | about contender | low | low | moderate | OK to low | very good | many | none |

- The values come from research/18's analogues:
  - frontier = today's leader;
  - contender = today's challenger;
  - talent breakaway = today's spinout;
  - capital-heavy = today's big-tech row (owned campuses, distribution);
  - from scratch = new, to source.
- The scattered per-start knobs become fields of the row: START_CREDIBILITY, START_EXPLOIT_MULT, PROVIDER, the spinout's
  cloud date, the credit-line branch, followerOpts. The row is the engine's only source.
- **Difficulty** is re-measured from the best bot at the checkpoint.

### 6.2 Lab kinds: holders + charter + position (names invented; analogues in tooltips)

| Kind | Like | Holders and charter at the start | Comes out as | Position |
|---|---|---|---|---|
| Frontier leader | OpenAI 2025 | Mission body + profit cap; Northwind ~27% (legacy, real strings) | Mission-controlled | Frontier |
| Safety-first contender | Anthropic 2025 | Mission body; Azimuth ~14% (cloud + custom chips) | Mission-controlled | Contender |
| Founder racer | xAI 2025 | Founders the majority | Founder-led | Capital-heavy |
| Big-tech lab | GDM 2025 | Azimuth 100% (replaces its in-house NPC lab) | Division of Azimuth | Capital-heavy |
| Talent breakaway | SSI, TML | Founders the majority | Founder-led | Talent breakaway |
| Newcomer | a 2025 startup | Founders + seed investors | Founder-led | From scratch |
| **Custom** | — | Choose a charter (mission body yes/no, profit cap) and a cap table preset (founder-majority, investor-heavy, partner stakes, or wholly owned by Azimuth) | emergent | any |

Each kind carries its own cap table, which fixes the 26% mission holder showing up under founder control. Picking a kind
fills Custom, so nothing stale is left over (fixes the setup bug). You can't start listed or government-controlled.

### 6.3 Setup screen

- The first row is lab kinds. Custom opens charter, holders and position beneath it, with the resulting board and label
  shown live.
- The world settings follow.
- Every option has a description and a tooltip.
- MEDIUM.md A3's wider re-flow is not part of this unless added.

## 7. On screen

- **Board card header:** the label, the controller (or "no controller") and the seat powers, e.g. "Mission-controlled ·
  the foundation holds 4 of 7 seats · mission veto · profit cap".
- **"Who controls you"** is one row: seats and votes by holder, the majority line, and what happens if it's crossed.
  It's the only home for voting control; the ownership donut stays the home for economic shares. Every raise, deal or
  merger preview shows the row's after-state.
- **Owner-funded companies** show the budget and the year's goals in the same card. FinanceDivision's separate panel
  merges into it.

## 8. Build order (each step cut into single-concern tasks)

1. **Holders, share classes, `boardOf`, seat powers, emergent controller and label** replace presets: GovernancePresetId,
   initialBoard, syncFinancialSeats, startBoard, the listing seat, the rescue's addSeat. Saves break.
2. **What a controller changes and how control is lost:**
   - money (market or owner budget) and goals;
   - the ouster under every board;
   - "another lab in control" (bought, or folded in by the leading lab), with 'acquired' and 'nationalized' removed;
   - every 50% path behind the votes.
3. **Government:** the soft path (staff pooling, directors with the security veto) and the hard path (the government as
   the controlling holder, or folded in).
4. **Positions + lab kinds + setup** (the Azimuth parent; the big-tech kind replaces its in-house NPC lab).
5. **Partners** (§5).
6. **UI:** Board card, "who controls you", Partners card, previews, glossary.
7. **Checkpoint:** bot runs for difficulty, the deal-balance check (no deal is free money or never worth taking), target
   F8 re-judged.
8. **Cleanup** (§9).

## 9. Cleanup (the last task)

Delete:
- GovernancePresetId and the preset strings; GOV_FACTOR as a preset table; RIVAL_GOV preset ids (rivals get a label);
- `OUSTER.legacyMult`; `noOuster`; `isDivision` reading the start; `founderControl` as a preset check;
- `syncFinancialSeats`; the "Listing independent" literal;
- `endingProgress.soldControl`, and the 'acquired' and 'nationalized' ending ids (folded into "another lab in control");
- the never-produced 'ipo' tranche condition; citations of the non-existent events E02 and E26;
- `issueWarrants`' copy of `issue()`;
- the `leaderLab` field and the stale `setup.leaderLab` comment;
- BOARD_LABEL, PRESET and the charter header table (one label source);
- the dead "trust notified" log;
- Corvid, the sovereign kind and its terms, `anchors`, the anchoring round path, and "served first" as a partner benefit.

Also:
- Fix the hubView $B ÷ 1e9 display.
- Block financing leases for owner-funded companies.

## 10. Inventory facts that shape the plan (a read-only survey, 2026-11-28, re-checked after the rebase)

- **The only structure change today** is the recap, which rewrites `preset` in place.
- **Bugs:**
  - A refused recap leaves an unmeetable 'recapitalisation' condition on every later large round.
  - Picking Big tech and then Leader in setup leaves `governance: 'parent'` on a leader game.
  - "Division" has two sources of truth (`isDivision` reads the start, `noOuster` reads the preset).
  - Partner tranches and anchor rounds can cross 50% with no vote.
- **E32 stock buyers** are booked as investors, so the 'acquired' ending names the wrong buyer.
- **Since the outside-world merge:**
  - nationalization is `usgov.consolidated`;
  - the soft path is E22 with `dpaAccepted`, and the epilogue reads "DPA + low trust at ASI" as government power;
  - scrutiny, the safety-index grade (GOV_SCORE) and the sovereign's politics no longer exist.
- **Tests that pin today's behaviour, all expected to change:**
  - scripts/v2/finance.ts FIN2–FIN5c;
  - hygiene.ts 162–200;
  - ws4.ts 205–212;
  - uitest.mjs (setup, board, partners, division);
  - the fixtures (start-challenger-day400 seats);
  - golden/ref-trace.json.
