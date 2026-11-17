# Company screen: IA note (rev 2, after the first review)

Files: `v3-company.html`, `v3-company.png`, `v3-company-hover.png` (open model picker on Routine research). Shell: `shell-crs.js` (top strip shows revenue only; weekly users live on the Chat card and in the revenue tooltip).

First glance (L1, three visuals): **agents at work** (one lane per internal use, STRUCTURE §4.9) with **research speed** at its right end, **teams by role**, **hiring**.

## Datum → level → home

| Datum | Level | Home | Elsewhere |
|---|---|---|---|
| L0 items (date, race, risk, cash and runway, revenue, lead, alerts) | L0 | Top strip | Weekly users → Products, Chat card; also in the revenue tooltip |
| Internal-use package: model, monitor and catch rate, compute and its budget (CAP / SAF), copies × speed, cost | L1 | Agents-at-work lane (**home of every internal package**) | Products holds product packages. Safety's "Trusted to AI" shows the safety-research model and monitor as link chips only |
| AI share of each role's work (engineers 62% → research engineers 38% → scientists 4%), takeover order 1-2-3 | L1 | Lane share bars | The milestone where each role goes fully AI, plus the formula, in the tooltip |
| AI taste −1.4 SD | L1 (quiet) | Frontier-research lane | — |
| Safety-research AI share (20%) | — | **Safety**, "Trusted to AI" (the control) | The lane shows a link chip "Trusted to AI · set on Safety ›" with no value |
| Model risk badges (4 families: low / watch / unseen) | L1 icon | Lane | Estimates ± band → Safety risk families (home); numbers in the tooltip |
| Auto split experiments ↔ agents (Capabilities budget) | L1 control | Agents-at-work header | Compute split shows the budget total |
| Total agent compute and cost (75K H100e, $1.01B/yr) | L1 (quiet) | Panel subtitle | — |
| Research speed 1.9×, compute-bound, return of +10% per input | L1 | Speed box at the end of the agents panel (home, per STRUCTURE §5) | Research shows only a link chip |
| Model comparison: copies, AI share before → after, research speed before → after, cost, risk | L2 | Model picker (hover / open state) | Preview, allowed |
| Teams and people per role; generic piles; science team cards (specialty, quality, assignment) | L1 | Teams card | Project progress, odds and ETA → Research |
| Payroll, morale, safety morale | L1 chips | Header | Breakdowns in the tooltip |
| Hiring targets, candidates with a gain preview, talent pull | L1 | Hiring card | — |
| Rules: build-queue priority; moving safety teams costs safety morale | L1 (quiet) | Teams card footer | — |

## Demoted on purpose
- Monitor slowdown, the monitor's own compute, the oversight-gap tier and per-trait risk → tooltips on the chips and badges.
- A models → uses flow diagram was left out: it is optional and would add density. Each lane already shows its model chip and compute width.

## Glossary terms needing tooltips
Internal agent · package · monitor · catch rate · copies × speed · H100e · Capabilities / Safety budget · Auto split · AI share of work · AI taste (SD) · Trusted to AI · risk family · unseen · research speed · compute-bound · payroll · morale · talent pull · Solid / Strong / Elite · specialty · build queue · know-how.
