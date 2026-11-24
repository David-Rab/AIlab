# Market mockup (Products): where every number comes from

Scenario: the designer's day-369 playtest save (`ai27-v2-day369.json`, Jul 5, 2026). `_data.ts` loads it with the current
engine and dumps `worldfx/productView.ts:productReadouts` to `data369.json`; `_shell.ts` reads the L0 shell through the same
selectors as `rd/_data.ts`. Run from the worktree root (it has no node_modules of its own):

    ../AI27/node_modules/.bin/tsx design/ux/mockups/market/_data.ts  <save.json>
    ../AI27/node_modules/.bin/tsx design/ux/mockups/market/_shell.ts <save.json>
    node design/ux/mockups/market/render.mjs products products:swap   (then products-swap.png → lineup-swap.png)

`data.js` holds the rounded values on screen. `render.mjs` is `rd/render.mjs` that also scans `rd/shell.js` for icons.

Basis: **F** = read from the save by today's engine. **D** = derived by hand from F values with the redesign's rules
(MARKET.md M2, M5, M7, M9); the new engine will compute these itself and may land elsewhere. **I** = illustration (a
plausible value with the stated reasoning; no engine computes it yet).

## The save's products and how they map to the four (M1)

| Save | Channel | Main model, lineup | → mockup |
|---|---|---|---|
| D1 | consumer | Atlas-3.0-mini; free tier Atlas-3.0-mini-mini | Chat |
| D2 | api | Atlas-2.0; Atlas-2.0-mini | API |
| D3 | enterprise | Atlas-3.0; Atlas-3.0-mini; sector adaptations FIN, HEALTH, GOV, MIL (certified) | Enterprise |
| D6 | gov | Atlas-3.0; Atlas-2.0-mini, Atlas-3.0-mini | Vetted (Gov → Vetted, MK-1) |
| D5 Agents, D7 Trusted | — | withdrawn in the save | not shown |

## One margin per hour (M5) — how API and Vetted were re-priced

Under M5 a seller's absolute margin per hour is the same on all its business products. Enterprise keeps the save's
revenue and serving cost (the anchors), which gives the margin:

- Enterprise served hours = `capHours` 17.06B/yr. Price/h = $54.28B ÷ 17.06B = **$3.18**; cost/h = $19.88B ÷ 17.06B =
  $1.165; margin per hour **M = $2.02** (Best profit).
- API and Vetted: price/h = their own cost/h (F) + M; revenue = served hours × price; profit = served hours × M.

The save's prices (cost × 2.5 markup) are replaced; Chat is its own market (M3) and keeps its $22/month plan.

## L1 #2 — product cards

| On screen | Chat | API | Enterprise | Vetted | From | Basis |
|---|---|---|---|---|---|---|
| Buyers ("sells to") | the public | small firms & developers | large firms | government, military, critical infrastructure, regulated firms | MARKET.md M1/M2 | design |
| Serving cost $/yr | $0.56B | $0.57B | $19.9B | $0.23B | `runCost` (served H100e × rental) | F |
| Revenue $/yr | $25.6B | $2.46B | $54.3B | $0.96B | Chat, Enterprise `revenue`; API 0.936B h × $2.63; Vetted 0.358B h × $2.68 | F / F / D / D |
| **Profit** $/yr | $25.0B | $1.89B | $34.4B | $0.72B | revenue − serving cost | F / D / F / D |
| Margin | 98% | 77% | 63% | 76% | profit ÷ revenue | as above |
| Revenue bar | — | — | — | — | common scale $0–56B for all four cards; gold = profit, grey = serving cost | — |
| Customers | 1.64B weekly users · 96.8M pay | 936M h/yr | 17.1B h/yr | 358M h/yr | Chat `users`, `subs`; others `capHours` (hours of work served a year) | F |
| Price | $22 /month, at the cap | $2.63 /h | $3.18 /h | $2.68 /h | Chat `price` (= willingness to pay, $22, so the M5 price is capped: M3); API cost/h $0.613 + M; Enterprise above; Vetted cost/h $0.656 + M | F / D / D / D |
| Serving compute served of needed (H100e) | 30.7k of 44.6k | 31.7k of 48.4k | 1.10M of 1.65M | 13.0k of 19.4k | `servedH100e`, `needH100e` | F |
| Turned away $/yr | free users rate-limited, paying users all served | $1.3B | $9.1B | $85M | unserved hours (`hours` − `capHours`) × list price (M7: rationing at the list price). Chat: `needPaidH100e` = served, so the cut (13.9k H100e, 31%) is free use | D |
| Price stance | Best profit (all four) | | | | MARKET.md M6; default | design |
| Lineup, hours sold | paying / free users | Atlas-2.0 66%, Atlas-2.0-mini 34% | Atlas-3.0 76%, Atlas-3.0-mini 24% | Atlas-3.0 73%, Atlas-3.0-mini 27%, Atlas-2.0-mini 0% ("sells nothing") | `lineup[].share` | F |
| Skill bars | | | | | the save's model `G`, scaled 0% = Atlas-2.0-mini-mini (26.59) … 100% = Atlas-4.0 (30.16). The build must read the player's **measured** skill, not `G` | F (true; build: measured) |
| Add a model · N you could add | 7 | 7 | 7 | 6 | the player's 9 non-retired models minus those in the lineup | F |
| Tools | Memory, Voice & vision, Companion | Coding harness, Computer use, Voice & vision | Research agent (certified Finance), Clinical assistant (certified Healthcare), Back-office agent (certified Government), Memory | Defence & intelligence suite (certified Military) | the save's features (`codingAgent` → Coding harness, `deepResearch` → Research agent); Enterprise's four sector adaptations mapped to the harness that covers the sector (MARKET.md tools table): FIN → Research agent, HEALTH → Clinical assistant, GOV → Back-office agent, MIL → Defence suite, which only Vetted carries, so it moves there | F + I (migration not specified, MK-11) |
| Add a tool · N more fit | 1 | 4 | 6 | 9 | MARKET.md tools table: tools the product can carry minus those it has | design |

## L1 #1 — totals strip

| On screen | Value | From | Basis |
|---|---|---|---|
| Profit from products | $62.0B/yr = 25.0 + 1.89 + 34.4 + 0.72 | sum of cards | D |
| Revenue, serving cost | $83.3B, $21.2B | sums | D |
| Serving compute | 1.17M of 1.76M H100e needed (66.5%); short 0.59M | `servingPool` = 1,174,000; need = sum of `needH100e` | F |
| Buyers turned away | $10.5B/yr = 9.1 + 1.3 + 0.085 | sum of cards | D |
| Business buyers: your share | 35% → 31% in ~16 mo; DeepCent 27% | `cust.stock` 0.347, `cust.target` 0.313, `cust.days` 483; `rival` DeepCent 0.2725 (the lab's held customers, M4: one number for the lab, so it lives here, not on each card) | F |

## L0 shell

| On screen | Value | From | Basis |
|---|---|---|---|
| Date | Jul 5, 2026 · day 369 | clock | F |
| Research speed | ×13.0 | `labSpeedView.rel` 13.04 | B |
| Lead | 195 d ahead of DeepCent | `nearestRival` est 195 (sd 68) | B |
| Cash · runway | $97.6B · 3 qtrs | `finance.cash`, `runwayLive` 2.96 q | F |
| Loss-of-control risk | < 0.1% | `controlReadout` p = 0.0001 (Atlas-4.0) | B |
| Alerts | 10 · 5 research, 5 other | log, severity ≥ 2, last 30 d (research 5, company 2, world 2, gov 1) | F |

## lineup-swap.png — Enterprise › Atlas-3.0-mini popover (all I)

Previews are a year at today's buyers, by the M5 identity profit = hours served × M (M = $2.02/h), with the lineup's hour
split re-guessed from skill and cost. Compute per hour of work ∝ the lineup's average FLOP per token (`fpt`: Atlas-3.0
1.6e12, 3.0-mini 2.0e11, 4.0-mini 2.5e11, 4.0-mini-mini 3.1e10, 2.0-mini 1.4e11, 3.0-mini-mini 2.5e10). Today: 76/24
split, average 1.26e12, 17.06B h served of 19.92B wanted, need 1.65M H100e, served 1.10M.

| Option | Assumed split (main / slot) | Hours served | Profit Δ | Hours Δ | Need Δ |
|---|---|---|---|---|---|
| Atlas-4.0-mini (skill above Atlas-3.0, cost ×1.25) | 30 / 70; demand +5% for quality | all 20.9B (need 0.90M < 1.10M served) | +$7.7B | +3.8B | −0.75M, "all buyers served" |
| Atlas-4.0-mini-mini (≈ same skill, ×0.16) | 70 / 30 | 19.1B | +$4.1B | +2.0B | −0.18M |
| Atlas-2.0-mini (lower, ×0.70) | 80 / 20 | 16.5B | −$1.1B | −0.6B | +0.06M |
| Atlas-3.0-mini-mini (lower, ×0.13) | 85 / 15 | 15.8B | −$2.5B | −1.3B | +0.13M |
| Remove from lineup | 100 / 0; cheap-task demand −10% | 13.5B | −$7.2B | −3.6B | +0.23M |

"Cost to serve" = the option's FLOP per token ÷ Atlas-3.0-mini's. "new" = the model is ready but not yet in any product
(Atlas-4.0-mini, -mini-mini: status `ready`). The white tick on each skill bar is the model being replaced. The build's
preview must be the tick's own function (MK-12), so these values are placeholders for layout only.
