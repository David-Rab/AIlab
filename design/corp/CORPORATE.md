# Corporate structure, partners and lab kinds

Status: designer's decisions taken 2026-11-28; ready to cut into tasks. Branch `corp` is rebased onto master 7ce0ad7e,
with the outside world merged.

Inputs:
- [DEALS-AUDIT.md](DEALS-AUDIT.md) (20 findings, with the engine's own offers at the fixtures);
- the code inventory (§10);
- research/15 §1.6–1.7, research/18, FINANCE-V3 §6–§7 and §13;
- world/usgov.ts.

## 0. The idea in one paragraph

A company is a set of **holders**: founders, a mission body, investors, partners, public shareholders and, after the hard
path, the government. Each holder wants something and gives something. One of them may be the **controller**. The
controller appoints the board's majority, decides where the money comes from, sets the goals the board judges you on,
and holds a short list of vetoes. Every board is then the same machine: seats, **one confidence meter** whose causes are
weighted by who sits on it, votes, and an ouster. A **structure** is only the name for who the controller is. When
ownership changes, the controller changes, and the same machine runs with different seats. Nothing is a preset, and no
change of owner ends the game. You lose control in only two ways:
- you are **removed** (the ouster);
- the company is **folded into another lab** or **goes bankrupt**.

## 1. Designer's decisions (2026-11-28)

1. **Three separate things.** Structure (who controls you), holders and partners (ties), and position (what you start
   with). A lab kind bundles them, and Custom mixes them.
2. **Five structures:** founder-led, mission-controlled (nonprofit and trust are one structure), public company,
   division of a parent, and government-controlled. They change during play.
3. **A holder above 50% doesn't end the game.** It becomes your parent.
4. **The government's soft path (the Defense Production Act):** if you lead, you stay as you are. You get part of the
   other US labs' compute and staff, and government directors join your board. **Only the hard path nationalizes.**
5. **Government control** works like a division, with very different goals.
6. **Rival labs stay simple.**
7. **Positions are five:**
   - three difficulties: frontier, contender, from scratch;
   - two trade-offs: capital-heavy and talent breakaway, both about as hard as contender.
8. **Accepted as recommended:**
   - public company = listed with no controller;
   - no exit from mission control;
   - a parent can remove you or fold you in;
   - one division model;
   - the big-tech parent is the partner Azimuth;
   - the revenue share becomes distribution;
   - partners act (renewals, follow-ons);
   - Corvid, anchoring and "one lab per partner" are removed.
9. **Open:**
   - drop sovereigns (§5.6);
   - add a sixth position, "distribution-heavy" (§6.1);
   - does the government pay a budget (§3.3).

## 2. Holders

Stored state: the **cap table**, which is today's `ownership`, and the **charter**, a few flags changed only by named
decisions:
- `missionBody`: a nonprofit or trust that appoints the board majority;
- `profitCap`: investors' returns are capped (only with a mission body);
- `dualClass`: founder shares carry ×10 votes (chosen at IPO, as today);
- `listed`: the company is on the stock market.

Everything below is derived from these two.

| Holder | Votes | What it wants: seat stance, and the causes its seats weigh most | What it gives |
|---|---|---|---|
| **Founders** (the CEO is one) | 1 per share; ×10 with dual-class | Your way (the CEO seat always votes yes) | The CEO; founder control while they hold the majority |
| **Mission body** | None from shares; it *appoints* the majority | Safety and mission; incidents ×2 | Credibility; a check on a reckless CEO |
| **Investors** | 1 per share | Speed and returns; promise results ×1.5, falling behind ×1.5 | Rounds |
| **Partners** (Northwind, Azimuth, Silica) | None while at or under the 15% cap (sourced Class N); full votes above it, as a controller | Their interest (§5): your spend on their cloud or chips, your models for their customers | Equity, supply, distribution |
| **Public** | 1 per share → independent seats | Results; setbacks ×1.5 | The public pool, bonds |
| **Government** | No shares: seats on the soft path (§4.2); the owner on the hard path | Security, a lead over China, no incidents; incidents ×1.5 | Pooled compute and staff (soft path); budget and compute (hard path) |

Seat stances and causes are today's tables (board.ts SEAT_STANCE, mood.ts MOOD_WEIGHTS). The `gov` seat kind already
has weights there but is never created. It now gets used, and gets its stance row (security- and safety-leaning [D]).

## 3. The controller

### 3.1 Who it is, which sets the structure name

| Controller | Rule (first that holds) | Structure | Analogues |
|---|---|---|---|
| The government | The hard path took the lab (§4.3) | **Government-controlled** | A nationalized lead lab; later China's lab |
| A corporate parent | One partner holds more than half the votes | **Division** | GDM, Meta AI; Waymo |
| The mission body | `missionBody` | **Mission-controlled** | OpenAI, Anthropic |
| Founders | Founders hold more than half the votes | **Founder-led** (or "Public company · founder control" when listed) | xAI; Meta (dual-class) |
| Nobody | Otherwise | **Public company** if listed, else **Founder-led** with the board run by votes | widely held labs |

The structure is computed, never stored. That removes today's two conflicting checks for "is this a division".

### 3.2 What the controller sets: the same five slots for every structure

| | Founders | Mission body | Nobody (public) | Parent | Government |
|---|---|---|---|---|---|
| **Board majority** (4 of 7) | Founders' seats | Mission seats | By votes: independents | Parent's seats | Oversight committee seats (`gov`) |
| **Money** | Markets: rounds, debt, partner deals | Markets at ×0.9 appeal; with a profit cap, large rounds are conditional until it's lifted | Markets + public pool + bonds | **Owner budget**: none of your own | **Owner budget** + pooled compute |
| **Goals the board judges** | Promises from your raises | Promises + incidents | Promises (results weigh more) | The parent's yearly goals: capability, scale, adoption (today's) | The government's yearly goals: security level, lead over China, no serious incident |
| **Vetoes and rights** | **Override:** force a failed vote at −20 confidence | Any holder passing 50%; handing out a capability-threshold model; releasing a red-flagged model | none | Deals with its competitors; issuing shares that take it below 50% | Any ownership change; handing out a capability-threshold model |
| **Removal** (§3.4) | Ouster vote | Ouster vote | Ouster vote | Ouster vote, or **folded in** | Ouster vote |

- **The board:** 7 seats. The controller appoints 4. The other 3 are shared by votes (largest remainder) among founders,
  investors, voting partners and the public. The CEO holds one seat. Extra seats go on top, up to 9: the critics seat,
  as today, and government directors on the soft path. Seats are recomputed whenever a round, deal, IPO, rescue, merger
  or change of control closes. Every preview shows the board as it will be after the change.
- **Investor appeal** (today's flat table GOV_FACTOR) becomes a product of charter features: profit cap ×0.67, mission
  body ×0.9, dual-class ×0.95, otherwise 1.0. Founder control's 1.1 goes, because R15 nets it to about 1.

### 3.3 One confidence meter, one goal mechanism, one budget rule

- **Board confidence** is the only meter. Its causes are weighted by the seats, as today. So a parent's board minds
  results and falling behind, the government's minds security and incidents, and a mission board minds incidents. The
  "very different goals" come from who sits on the board and what goals they set; no new meter is needed. A division's
  "parent confidence" becomes this same meter (today it already is under the hood).
- **Goals** use the existing promise mechanism (FIN2). Investors' promises come from your pitch. A parent's and the
  government's are set at each yearly review.
- **Owner budget** (finance/parent.ts) is the owner's plan × min(1, 0.5 + confidence ÷ 120):
  - a **parent's** plan: as today;
  - a **parent that took control mid-game**: your last four quarters of spending become year 0;
  - the **government's** plan: open, decision 9. The recommendation is yes (it "works like a division"). Year 0 is your
    last four quarters of spending, growing on a national-project path. The source for that path is still to find; it's
    marked [D] until then.
- **Owner-funded companies** have no raises, debt or partner deals of their own, and cannot go bankrupt. Overspending
  costs confidence, as today.

### 3.4 Removal: one rule

- **The ouster vote** applies under **every** controller: below 25 confidence after a 60-day warning, voted seat by seat.
  The controller's 4 seats usually decide it. This removes the special "a division can't be ousted" case.
  - Under a parent, the parent's seats lean on its goals.
  - Under the government, the government's seats lean on security.
  - So "the parent dismisses you" needs no separate rule.
- **Folded in (the "dissolved" ending):** when the ouster passes and the controller has its own lab that is ahead of you
  (Azimuth's in-house lab), it merges you in. The hard path with you behind is the same ending: you're folded into the
  national project.
- **Bankrupt (insolvent):** only for market-funded companies, as today.

Loss endings: **ousted, folded in, bankrupt.** "Acquired" is gone, and "nationalized" becomes the national-project case
of folded in.

## 4. How control changes

Each change is a named action or event with a full preview, and each one shows its board and controller afterwards.

| Change | How | Votes | From → to |
|---|---|---|---|
| **IPO** | `fin.ipo` (as today) | none | Private → listed (dual-class keeps founder control) |
| **Lift the profit cap** (was "recapitalise") | Action; about 4 quarters of Attorney General review, safety-staff morale −3 | none | Mission + cap → mission (the conditional tranche is paid) |
| **Founders lose the majority** | Emergent from dilution; every raise preview says so ahead of time | — | Founder-led → board by votes |
| **A holder passes 50%** | Rescue, partner tranches, stock paid in a merger: **every** path is judged at the stake it will reach | Mission body first (cannot be forced), then the board | Any → Division |
| **Soft path** (E22, §4.2) | You accept, as the frontier lab | none | No structure change: government directors join |
| **Hard path** (§4.3) | The government takes the lab | none | Leading: → Government-controlled. Behind: folded in |

**Not offered:** leaving mission control (state Attorney Generals stopped exactly this in May 2025), or a spin-out from
a parent or from the government.

### 4.2 The soft path: Defense Production Act consolidation, as the lead lab

Today, accepting E22 pools 50% of each US rival lab's compute into you as free cloud capacity, and nothing else changes.

New:
- It also pools a share of their **staff**: whole teams join yours, at the same share as the compute [D].
- **Government directors** take 2 seats on top of the 7: the `gov` kind, with the security-leaning stance and the
  incident and security weights.
- You stay as you are: same controller, same money, same rights.
- The government directors vote on major decisions. Their weights shift what the board minds.

### 4.3 The hard path: nationalization

The trigger is unchanged: low trust past the hold time at stage 3 or above, or the misalignment-leak scare.

- **If you are the frontier lab:** you become government-controlled and stay CEO.
  - The oversight committee appoints 4 seats.
  - Confidence starts at 40, on probation: below the warning line, above the ouster line.
  - The government's goals and budget apply from the next review.
- **If you are not the frontier lab:** you're folded into the national project. That's a loss.

## 5. Partners and deals

The audit's 20 findings are in DEALS-AUDIT.md §5. This is the design that answers them.

### 5.1 Cast and interests (NPC-simple)

Northwind (Microsoft-like cloud), Azimuth (Google/Amazon-like cloud with custom chips and an in-house lab), Silica
(Nvidia-like chips). Corvid goes. Each partner has **one interest**, shown in player words. It moves the partner's offers:

| Partner | Values you more when | Values you less when |
|---|---|---|
| A hyperscaler | You spend on its cloud; your models sell through it | Its own lab nears you (Azimuth); you lean on its competitor |
| Silica | You deploy its chips | You buy custom chips instead |

### 5.2 One deal shape: equity for a compute commitment in dollars

- The partner invests E. You commit to spend 4 × E (sourced 2–12×) on its supply over the deal. The commitment is in
  dollars, so the capacity it buys grows as prices fall. Custom chips are a supply option inside the same commitment.
- **Tranches** are paid "after $X of the commitment is spent", which is what the partner sells. The gigawatt conditions
  and the $5B floor go.
- **Distribution replaces the 8% revenue share.** The partner resells your models to its cloud customers. That's a
  channel adding API and enterprise reach, and it takes a cut of that channel only, shown with a projection. The
  leader's legacy Northwind stake keeps its real all-revenue share, projected the same way.

### 5.3 Strings that cost something visible and end with the deal

- **Exclusivity:** no deals with the partner's competitor while the deal runs. The preview names the blocked competitor
  and what it would offer today.
- **IP access:** the partner's lab licenses your models while the deal runs. The preview gives the cost in lead ("its lab
  ends about 4 months closer"). The rate is [D] until sourced (finding 6).

### 5.4 Partners act, rarely

- **When a deal ends**, the partner offers a renewal. The terms follow its interest and your **dependence** on it (the
  share of your compute it supplies).
- **Follow-on offers** appear as an action, not an event, when its interest is high.
- The limit counts **running** deals, one per partner.

### 5.5 Rescue, stakes and control

- **Rescue** is a distressed round with strings, on the same card as the down round. It comes from the partner that
  values you most, priced by your distress. It may cross 50%, which makes you that partner's division, through the
  votes.
- **Stakes:** partner stakes are capped at 15% with no votes (antitrust, sourced). The only way past is a rescue or a
  merger, both through the control votes. **The separate anchoring channel is removed.**
- **Rival labs** keep no partner mechanics. A rival card shows a backer label only. The dead "one lab per partner" rule
  goes.

### 5.6 Sovereigns: drop them (recommended; designer to confirm)

As built, a sovereign is a cheque with no strings and no choice: money the investor pool already provides. Since the
outside-world merge its political cost is gone too. The one real-world dynamic worth having is Gulf deals pairing money
with **sites abroad**: cheap power and fast builds against export-control and security risk. That's a data-centre and
world decision, not a partner. If wanted, it goes to OPEN.md as a later idea for the data-centre system.

### 5.7 One home

- **A Partners card** in Finance has one row per partner: what it wants, what it gives, how much it values you, your
  dependence on it, and its running deal with the terms still to come. The rescue sits on the distress card.
- Every string's future cost is in the preview. The stake on the card is the number the votes use.
- The glossary is rewritten in player words.

## 6. Positions and lab kinds

### 6.1 Position: what you start with (no structure, no partners)

| Position | Difficulty | Compute | Cash | Staff | Model | Research | Stars | Products |
|---|---|---|---|---|---|---|---|---|
| **Frontier** | easiest | good | good | good | best | best | good | full |
| **Contender** | middle | less | less | less | months behind | less | some | some |
| **From scratch** | hardest | low | low | low | imported open weights | low | few | none |
| **Capital-heavy** (trade-off, about contender) | — | a lot | a lot | a lot | weak | weak | few | some |
| **Talent breakaway** (trade-off, about contender) | — | low | low | moderate | OK to low | very good | many | none |
| *Distribution-heavy?* (open, decision 9) | — | good | good | good | behind | middling | some | large user base |

- The values come from research/18's analogues, re-cut by row:
  - frontier = today's leader;
  - contender = today's challenger;
  - talent breakaway = today's spinout;
  - capital-heavy = today's big-tech values, without the parent;
  - from scratch = new, to source.
- The per-start knobs scattered through the code become fields of the row: START_CREDIBILITY, START_EXPLOIT_MULT,
  PROVIDER, the spinout's cloud date, the credit-line branch, followerOpts. The row is the engine's only source; today
  the leader row is display-only.
- **Difficulty** is re-measured from the best bot at the checkpoint.

### 6.2 Lab kinds: structure + holders + position (names invented; analogues in tooltips)

| Kind | Like | Structure | Holders at the start | Position |
|---|---|---|---|---|
| Frontier leader | OpenAI 2025 | Mission + profit cap | Northwind ~27% (legacy, real strings) | Frontier |
| Safety-first contender | Anthropic 2025 | Mission | Azimuth ~14% (cloud + custom chips) | Contender |
| Founder racer | xAI 2025 | Founder-led | none | Capital-heavy |
| Big-tech lab | GDM 2025 | Division of Azimuth (in place of its in-house NPC lab) | the parent | Capital-heavy (owned campuses) |
| Talent breakaway | SSI, TML | Founder-led | none | Talent breakaway |
| Newcomer | a 2025 startup | Founder-led | none | From scratch |
| **Custom** | — | Founder-led / mission / mission + cap / division | any allowed partners | any position |

Each kind carries its own cap table, which fixes the 26% mission holder showing up under founder control. Picking a
kind fills the Custom fields, so nothing stale is left over (fixes the setup bug). You can't start public or
government-controlled.

### 6.3 Setup screen

- The first row is lab kinds. Custom opens structure, position and partners beneath it.
- The world settings follow.
- Every option has a description and a tooltip.
- MEDIUM.md A3's wider re-flow (scenario first, Storyteller and Tutorial moved to options) isn't part of this unless
  added.

## 7. On screen

- **Board card header:** structure, controller and rights, e.g. "Mission-controlled · Foundation appoints 4 of 7 ·
  Mission veto · Profit cap".
- **"Who controls you"** is one row: votes by holder, the 50% line, and what happens if it's crossed. It's the only home
  for voting control; the ownership donut stays the home for economic shares. Every raise, deal or merger preview shows
  the row's after-state.
- **Owner-funded companies** show the budget and the year's goals in the same card. FinanceDivision's separate panel
  merges into it.

## 8. Build order (each step cut into single-concern tasks)

1. **Holders + controller + `boardOf` + structure name** replace presets: GovernancePresetId, initialBoard,
   syncFinancialSeats, startBoard, the listing seat, the rescue's addSeat. Saves break.
2. **Controller slots:**
   - money (market or owner budget);
   - goals (promises; parent and government goals);
   - vetoes and the founder override;
   - the ouster under every controller;
   - folded in;
   - removal of 'acquired';
   - every 50% path behind the votes.
3. **Government:** the soft path (staff pooling, government directors) and the hard path (government-controlled, or
   folded in).
4. **Positions + lab kinds + setup** (the parent is Azimuth; the big-tech kind replaces its in-house NPC lab).
5. **Partners** (§5).
6. **UI:** Board card, "who controls you", Partners card, previews, glossary.
7. **Checkpoint:** bot runs for difficulty, the deal-balance check (no deal is free money or never worth taking), target
   F8 re-judged.
8. **Cleanup** (§9).

## 9. Cleanup (the last task)

Delete:
- GovernancePresetId and the preset strings; GOV_FACTOR as a preset table; RIVAL_GOV preset ids (rivals get a label);
- `OUSTER.legacyMult`; `noOuster`; `isDivision` reading the start;
- `syncFinancialSeats`; the "Listing independent" literal;
- `endingProgress.soldControl` and the 'acquired' ending;
- the never-produced 'ipo' tranche condition; citations of the non-existent events E02 and E26;
- `issueWarrants`' copy of `issue()`;
- the `leaderLab` field and the stale `setup.leaderLab` comment;
- BOARD_LABEL, PRESET and the charter header table (one label source);
- the dead "trust notified" log;
- Corvid, `anchors`, the anchoring round path, the sovereign kind (if confirmed), and "served first" as a partner benefit.

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
