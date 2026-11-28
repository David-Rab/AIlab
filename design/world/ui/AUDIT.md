# Outside-world UI audit (W8a)

Method: the real app (`vite build`), day-400 and day-900 fixtures, headless Edge, 1680x1000 (`design/world/ui/audit.mjs`).
Screenshots: `design/world/ui/audit/d400-*.png`, `d900-*.png` (relations, world-sectors, world-risk, world-society, overview).
Rules from the good-ui skill and design/ux/IA.md. Day-400 state: stage 0, tension 0, concern 50. Day 900: stage 1, tension 2
(national collective), concern 55, approval -14, three dated laws in force.

## A. Relations panel (the current "government / China / public" home)

| # | Element | Problem (rule broken) | Fix |
|---|---|---|---|
| A1 | Whole panel (d900-relations) | Three actors are shown as text rows. No first-glance picture; at day 400 and 900 the panel looks the same. (visual over text; L1 needs 2-4 visuals) | Rebuild as "Powers": three actor cards with ladders, gauges and tracks (mockups/powers-home.png). |
| A2 | Security stage row: "1 · Security expectations" | A 0-4 ladder is a single string. The player cannot see what the other rungs are, what the next one needs, or what any rung does to them. (cause and effect; show what binds) | Vertical ladder, current rung lit, next rung dashed with its trigger and a hold-timer bar, one line "what it asks of you" per rung. |
| A3 | "Its requirements do not apply to you: your lab is not prominent enough" | A sentence in permanent UI, and the attention number behind it is not shown anywhere. (terse language; one home) | "Your prominence" gauge (the attention number) in the top rail, with a one-line status. Hover: frontier part, reach part. |
| A4 | Oversight committee: "none/accepted", Consolidation: "none / pooled / taken over" | Two rows that are really stage 3 and stage 4. Duplicates the stage datum. (one home) | Fold into the ladder rows: rung 3 shows "accepted/refused", rung 4 shows the consolidation outcome. |
| A5 | "Laws in force": comma-separated names | A text list of only what is on. Cannot see what is not in force or what turns a law on. SB 53, RAISE and EU AI Act have no Term (no underline, no tooltip). (tooltip for every term; finite list as a visual) | Chip grid of all 11 laws, lit when in force, dim when not; hover = rule, threshold, effect, distance to the threshold. Add the missing terms. |
| A6 | "Brief officials" button (B7) | A bare button in the US card, 80 px from the thing it changes (what Washington sees) and with no value shown: the player cannot tell the current briefing level (none / partial / full) or what each level does. (controls beside the info they change; show consequence before commit) | A three-way segmented control inside the US card with a before-to-after line (milestone delay, stage timing, trust per month). |
| A7 | "Trust 61" in the card corner | A bare number, no trend, no gauge, no why. (every number has a why; trends) | Gauge plus 90-day arrow; hover lists up/down causes (security floor, briefing, thefts, cover-ups). |
| A8 | China: "Tension: National collective", "Talks: No talks" | Same as A2. Also the real driver of the ladder (the US lead over China, with its 6 and 9 month thresholds) is nowhere. (cause and effect) | Lead-over-China track with the tension thresholds drawn on it, tension ladder with "what it does to you", four-step talks track. |
| A9 | "Concern 55 / Approval -14" in the header, text only | Two big-picture numbers set in the page header in the smallest type; no trend, no scale (what is high?), no link to the laws concern triggers. (layout signals importance; show trends) | Concern gauge with threshold ticks (70 licensing, 75 human mandate) and target marker; approval diverging bar; sparklines. |
| A10 | Obligations card: "No commitments yet", then the pledge buttons are in a different card under "Actions" and tab "Testing & transparency" | The three pledges (pre-deploy testing, framework, whistleblower) are hidden behind a group picker with two other empty-ish tabs ("Rivals", "Public"); no preview of what a pledge buys or costs. (discoverable; preview) | One Pledges and obligations card: the list with Honour / Amend / Break, and "Make a pledge" tiles with effect pills. Drop the group picker. |
| A11 | Actions section: group picker (Testing, Rivals, Public) | After the W7 cut, groups "Rivals" and "Public" hold at most a few actions each; a picker for 3 buttons. (demote clutter) | Remove the picker; actions live next to what they change (A6, A10). |
| A12 | "Retire..." in a full-width row | Fine behaviour (confirm), but the row takes the same weight as real controls. | Move to the menu (≡) or a footer link inside Powers; keep the confirm. |
| A13 | Panel name "Relations" and sub "obligations and actions" | The name no longer matches what it shows (three powers); the sub describes the old action catalogue. | Rename "Powers", sub "Washington · Beijing · the public". Nav tooltip updated. |
| A14 | Empty lower half (both fixtures) | About 55% of the screen is blank. (dead space) | The rebuilt layout fills the page (pledges, laws, ladders). |

## B. World panel

| # | Element | Problem | Fix |
|---|---|---|---|
| B1 | Macro strip (GDP growth, AI share of income, Robots/mo): three bare numbers above every tab | Shown on all three tabs, so it reads as permanent chrome; no trend; Robots is post-ASI flavour next to the headline economy. (permanent areas hold top-level items; trends; demote) | Move to the Work tab as four readout tiles with sparklines and 12-month deltas; Robots moves to Tech and control. |
| B2 | Jobs card (d900-world-sectors) | Seven rows of mixed type: unemployment bars (2 dp elsewhere, 1 dp here), "US 12-month change" with a tiny sparkline, "Youth unemployment . exposed jobs" (two figures in one row), "Displaced", "Remote work automated . firm adoption" (two figures), "Automation share US", then the transition-fund slider. (overwhelm; one datum per row) | Unemployment US moves to a headline tile (with youth as its sub-label and the 12-month delta). Jobs card keeps unemployment bars, displaced workers, the fund. |
| B3 | Adoption numbers: "Workers using AI 41%", "Hours of use 7.1%", "Remote work automated 7%", "firm adoption 30%", "Automation share US 3.0%" | Five overlapping adoption numbers in one screen, with different bases and no explanation of how they differ. (one home per datum; honest labels) | Keep three, each with one definition: workers using AI, hours of use, work done by AI (automated). Drop "remote work automated" and "firm adoption" from World (they stay in the Codex); W8b to check which engine quantity each maps to. |
| B4 | Sector card "Providers" table (seven labs with share, target, price) | A market table on a world-economy tab; duplicates Finance > Story (your share by sector). (one home) | Replace with a reference chip "Providers . your share" to Finance > Story. |
| B5 | Heatmap rows: tall left text, cells 25 px, dead area right of the card | The heatmap and sector card do not align; empty band under the sector card on day 400. | Equal-height cards; heatmap rows 30 px. |
| B6 | Society tab ("Control & tech"): a tab named for two unrelated things; the control index legend names the player "OpenBrain" (AI 2027 canon name, d900-world-society) | Tab title does not say what it holds; the legend has a hard-coded canon name. | Rename "Tech & control"; legend uses the company name from setup. |
| B7 | Control index tier ticks "entrenched / indispensable / decisive" (tiny grey labels under each bar, 9 px) | Unreadable; the three names are the only explanation. | One caption line under the card; hover explains each tick. |
| B8 | World technologies grid: 29 tiles, name plus a 40 px bar | No status word; "locked" vs "available" is a border colour only (colour alone). Needs and gates only in the hover. | Two-line tile: name, status ("ramping 40%", "locked . needs X"), full-width bar. |
| B9 | Risk tab: the "War" and "China" rows duplicate China tension (war is the tension 4 rung; theft is a China flow) | Same story on two screens. | Keep the risk rows (they are a different datum: chance of harm), but link the China and War rows to Powers with a reference chip. |
| B10 | Risk tab flows diagram runs below the fold at 1000 px; nodes overlap the screen edge | Not visible without scrolling; the bottom nodes are clipped. | Out of W8 scope (existing Risk work); note for W8b only if Risk is touched. |

## C. Top strip, nav, queue

| # | Element | Problem | Fix |
|---|---|---|---|
| C1 | Top strip: nothing from the outside world | Stage climbs (clearances, an oversight committee) are the biggest outside events a player meets, yet nothing in L0 says Washington moved. | No new L0 number (one home). The Powers nav icon carries a badge when a beat waits (stage climb, treaty offer, pledge binding); a Watch chain on the Overview ("Clearances land on you > staff and speed cost"). |
| C2 | Nav label "Relations" (handshake) | Name no longer matches (A13). | "Powers". |
| C3 | Lead chip names only the nearest rival | China is one of the labs, but the US lead over China (the datum that drives tension) is invisible on L0. | Stays out of L0 (it is a world datum); its home is the Powers China card. |
| C4 | Bottom bar headlines | The outside-world headlines (stage climbs, laws, protests) arrive as the latest-headline line only; no link to cause. | Headline click opens Powers on the matching card (anchor). |

## D. Glossary gaps (terms the outside-world UI shows without a tooltip)

California SB 53, New York RAISE Act and EU AI Act (rendered as plain text in Relations: `LAW_TERM` has no entry), Strict chip export controls
(law), government briefing level, prominence (attention), public frontier, public incidents (incident heat), US lead over China,
restraint pact (talks steps), the security-stage rungs themselves (only the umbrella "Security stage" exists), automation share
("work done by AI"), control index (the id is `leverage`; the label says Control index), the three pledges.
Full list in IA-WORLD.md.

## E. Tooltips on the existing outside-world numbers

Concern, approval, trust and unemployment have a tooltip, but it is one sentence with no breakdown (rule: every number has a
"why"). No outside-world number shows what moves it or how far it is from the next effect.
Fix: breakdown tooltips with cause bars (concern: base, milestones, unemployment, incidents), the next threshold, and nested terms
(mockups/powers-tooltip-why.png). W8b needs one new selector per meter (concern parts exist as terms of `concernTarget`; trust needs
a monthly cause ledger entry list; approval has the ledger already).
