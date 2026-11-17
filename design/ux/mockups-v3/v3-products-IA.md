# Products — IA note (v3)

Screen: Products (was Deploy). Shots: `v3-products.png`, `v3-products-edit.png` (API edited live: Standard →
Premium, Atlas-3.0 → Atlas-3.1), `v3-products-hover.png` (nested tooltip on API "capacity-bound").

## Levels and homes

| Datum | Level | Home (single) | Notes |
|---|---|---|---|
| Revenue run-rate total $14.0B/yr, cash, runway, etc. | L0 | Top strip | Product revenues are its parts (breakdown, allowed) |
| Per product: revenue/yr + 30-day trend + 6-month chart | L1 | Product card (hero) | |
| Per product: customers (users, developers, orgs, seats) | L1 | Product card | Weekly users live on the Chat card only; L0 shows revenue, users in its tooltip |
| Share of segment spend vs best rival product (two bars, same scale) | L1 | Product card | Other rivals: tooltip |
| Binding cause (quality / price / capacity) + best lever with its gain | L1 | Product card, amber box | Lever is a preview; click goes to the control |
| Package: model slot (model + mini tier; clearance tick), monitor slot (model + catch rate), run cost $/yr (monitor ≈ +6% serving) | L1 control | Product card, dropdowns | Editable live (R4). Catch-rate breakdown (capability gap, control techniques): tooltip |
| Features: built once lab-wide, toggled on/off per product; building (engineers, time left); unlockable (cost, team-weeks, Build) | L2 | Product card | Feature effects and build queue position: tooltip |
| Settings: price tier, safeguards (classifiers), KYC level | L2 control | Product card foot ("live") | Each opens a picker in place; nothing is withdrawn |
| Edit preview: customers, revenue, share, binding, serving need, before → after; Apply / Cancel | L2 | Popover anchored to the edited card | Shows "stays live" and the effective date |
| Agents gate: time horizon 2.6 h vs 4 h needed; rival share 52%; path (Atlas-3.2 link) | L1 | Agents card | Launch disabled; tooltip says why |
| Serving split by product (118K / 86K / 60K / 26K) + unserved API demand (+22K ghost) | L1 | Serving compute card | Total budget lives on Compute (link "Budget") |
| Policies: Auto rule (on: serve the most $ per H100e first, show what is cut), override; upgrade to newest cleared model (off) + "3 on Atlas-3.0" | L1 control | Serving card header; panel header | |
| Demand (incl. monitor), served, unserved $, revenue per H100e, what Auto cuts | L3 | Tooltip on "capacity-bound" → child tooltip "Auto rule" | |
| Price elasticities, safeguard costs (serving %, refusals, demand −2% per KYC tier), sector-pack effects | L3 | Tooltips on the pickers | |

## Demoted
Leak %, per-channel serving sliders and Withdraw buttons of the old Deploy screen (gone: auto-split policy + live
edit); demand-vs-capacity table (→ capacity tooltip); per-sector detail of Enterprise (→ tooltip on sector packs);
the full rival list per segment (→ share tooltip); usage policy (→ safeguards picker).

## Glossary terms needing tooltips
run-rate · share (segment) · best rival product · binding cause · quality-bound / price-bound / capacity-bound ·
price tier (Budget / Standard / Premium) · safeguards · misuse classifiers · KYC · sector pack · feature build ·
team-week · release clearance · mini (distilled) model · serving compute · H100e · auto-split · override / floor ·
upgrade policy · time horizon · agent tasks · package · monitor · catch rate · run cost · Auto rule · built once.

## Open questions
1. Monitor cost: SCENARIO gives ~6% for a mini monitor; the edit preview assumes Atlas-3.0 as API monitor costs +14%. Needs an engine number.
2. Does an edit apply immediately or next tick ("from 13 Mar")? Enterprise contracts may need a notice period.
