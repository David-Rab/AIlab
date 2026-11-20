# v2 information architecture

Binding for the UX implementation. It overrides PLAN.md and PROPOSALS.md where they disagree.

**The four rules** (user, binding):
1. **Hierarchy.** At first glance the player sees only the top-level picture: a few key visuals. Everything else is one click (panel, card) or one hover (breakdown, term) away. The UI shows what is important by size and position, not by colour alone.
2. **One home per datum.** Every number or state the UI shows has exactly one home. Elsewhere it appears only as a **reference**: a link chip that names it and jumps to its home. A reference never repeats the value.
3. **Permanent areas hold only top-level items.** Top strip, nav and bottom bar.
4. **Every technical or business term has a tooltip.** Glossary entries nest (CK3). See `GLOSSARY.md`.

**Allowed, and not a duplicate:**
- A **breakdown** in a tooltip that lists the parts of a displayed aggregate. For example, the runway tooltip lists burn by category.
- A **preview** (before→after) on an action or decision card. It shows a hypothetical after-state; the "before" tick is an unlabeled reference mark.
- A **history** chart of a datum. History is its own datum; the chart carries no current-value label.

---

## 1. Levels

| Level | What | Where | Budget |
|---|---|---|---|
| **L0** | Always visible. The state of the game in one look. | Top strip, nav, bottom bar | ≤ 7 items |
| **L1** | The main screen (Overview): who is ahead, how the race got here, what needs you now. | Centre, Overview | 3 cards (+1 Goals card while the tutorial runs) |
| **L2** | Panels and their tabs: the controls, and every datum below the top level. | Centre, one panel at a time | — |
| **L3** | Tooltips (why, breakdowns, terms, previews) and the Codex. | Hover; the Codex panel | — |

### L0: seven items

| # | Item | Shows | Hover (L3) | Click |
|---|---|---|---|---|
| 1 | **Time** | Pause, speeds 1–4 with key hints, FF menu; date and "Act 3 · Automation" under it | Speed and FF rules; the act's unlock trigger | — |
| 2 | **The race** (hero, ~3× the width of any other item) | Capability L (violet) and Understanding U (teal) on one 5–15 scale; milestone ticks; the gap hatched red with a "2.0 BLIND" tag, or green "1.7 AHEAD"; an "evaluating" marker when the internal agent has no eval yet | Detection per critical trait against the 50% line; why U moved (90 d); levers | Safety lab, Graph tab |
| 3 | **Catastrophe risk** | Gauge with the estimate and its band | The top 3 risk sources | Risk panel |
| 4 | **Cash · runway** | Cash; a runway gauge (zones distress < 3q, tight < 6q, healthy) with the live state; a "Tight on ‹date›" tag when the next quarterly review will flip state | Runway breakdown (liquidity, burn by category); cash causes over 30 d | Finance |
| 5 | **Lead · nearest** | Days ahead of (or behind) the nearest rival, and its name | Every lab's lead ± intel error | Overview, lead track |
| 6 | **Nav** | 12 panels grouped by sphere. Badges show where action waits: Watch count on Overview, decisions per sphere, new findings, idle chips | Panel description; lock reason with its trigger | The panel |
| 7 | **Queue** (bottom bar) | Decision chips with ring timers; one collapsed alert chip ("4 alerts"); the latest headline | Alert list; headline list | Decision modal; the alert's panel |

Also in the strip, as controls rather than data: `?` help and `≡` menu.

**Removed from L0** (each moves to one home below):
- Compute online → Company, Flow tab. Idle chips → Compute, Overview (design/ux/COMPUTE.md).
- Scrutiny → Relations.
- R&D multiplier M → Company, Research speed.
- The act chip → under the date.
- China lead → the lead track.
- The ticker's scrolling list → one headline line.
- The right rail. Its blocks move to Company (research speed), Runs (next-model gates), Relations (obligations, counterparties) and Overview (rivals as the lead track). Freeing 280 px gives panels room.

### L1: the Overview (main screen)

Three cards. Nothing else.

| Card | Visual | Answers | Drill-down |
|---|---|---|---|
| **Lead track** (top, full width) | One lane per lab (US rivals and China). Each lab's token sits at its estimated lead relative to you (centre line = you, 0 d) with an intel-error whisker. Left = they are ahead. | Who is close, who is ahead, how sure am I | Hover a lane: lead ± sd, misalignment band, Index grade, public model. Click: Relations |
| **Race history** (bottom left) | L and U over the whole game, the gap shaded (red when blind), model switches marked | When and why the gap opened | Hover a point: date, L, U, internal model. Click: Safety lab |
| **Watch** (bottom right) | ≤ 4 rule-generated items. Each is a cause chain (`root ▸ symptom`), a one-line consequence and a **Go** button to the control that fixes it. The empty state is a green check: "Nothing needs you". | What is wrong and where I fix it | Hover a chip: the numbers. Go: the panel, scrolled to the control |
| **Goals** (tutorial, acts 1–2) | Checklist of the act's goals, ticked from state; "Unlocks next" with triggers | What to try next | Go per goal |

### L2: panels (nav order)

| Group | Panel (`data-nav`) | Tabs | First-glance visual of the panel |
|---|---|---|---|
| — | Overview (`overview`) | — | Lead track |
| COMPANY | Company (`company`) | Flow · People · Split · Security | Flow diagram: compute online → pools by department → outputs |
| | Finance (`finance`) | Cash · Story · What we owe · Contracts · Board & owners · Debt & partners (a division: Cash · What we owe · Contracts · Board) | Cash-flow waterfall (Story tab: sector value × your share) |
| | Compute (`compute`) | Overview · Sites · Orders · Market | Verdicts (idle chips, racks ahead, vendor fill); capacity and fleet forecast; order chips / build data centre / rent cloud |
| MODELS | Models (`models`) | — | Model card (radar against the previous version) |
| | Runs (`rundesigner`) | — | Recipe tiles with effect glyphs, plus "What this recipe pushes" |
| | Deploy (`deployments`) | — | Demand vs capacity per channel |
| SAFETY | Safety lab (`safety`) | Graph · Agendas · Tools · Incidents · Findings | Trait graph |
| | Risk (`risk`) | Sources · Flows | Ranked risk-source bars |
| WORLD | Relations (`relations`) | — | Counterparty cards |
| | World (`world`) | — | Automation spread tiles |
| — | Codex (`codex`) | — | — |

Inside a panel the same rule repeats: one primary visual at the top, then secondary cards, then tables. Long tables (agenda portfolio, techniques, ledger, benchmarks) sit in their own tab or behind a "more" toggle.

### L3: tooltips and the Codex

- **Why-card** on every number: value; 30-d cause bars from the ledger, or a formula breakdown; up to 3 lever links.
- **Terms**: every technical or business word is a `Term` (dotted underline). Terms nest; `Alt` or a 0.7 s hover locks the card.
- **Previews**: action and choice hover shows costs, gains and exposure.
- **Codex**: every glossary entry, trait, edge, agenda, benchmark, paradigm, sector, technology, action and event, with sources and [D] flags.

---

## 2. Datum → home

`→` marks a reference (a link chip without the value). "hover" means the tooltip of the home element.

### Race, risk and rivals

| Datum | Home | References |
|---|---|---|
| Capability L (measured, internal agent), evaluating marker | L0 race meter | Runs (ruler "now" tick, unlabeled) |
| Understanding U; gap U − L | L0 race meter | Watch chips; Safety Graph (→ race) |
| Detection per critical trait at L | L0 race hover | Safety "Can your tools see it?" grid (detection by level is its own datum) |
| Why U moved | L0 race hover | — |
| L and U history, model switches | L1 race history | — |
| Catastrophe risk estimate and band | L0 risk gauge | Risk panel (→) |
| Risk per source, drivers, levers | L2 Risk › Sources | L0 risk hover (top 3, breakdown) |
| Theft, distillation, talent and open-weight flows | L2 Risk › Flows | — |
| Nearest rival lead | L0 lead chip | — |
| Per-lab lead ± sd, misalignment band, public model | L1 lead track (position; numbers on hover) | — |
| Safety Index grades | L2 Relations › Research bodies | Lead-track hover (breakdown) |
| Watch items | L1 Watch | Nav badge (count) |

### Money

| Datum | Home | References |
|---|---|---|
| Cash | L0 cash chip | Finance cash chart (history) |
| Runway (q, state, next flip) | L0 cash chip gauge | Finance (→) |
| Burn by category this quarter; net burn | L2 Finance waterfall | L0 cash hover (breakdown) |
| Revenue run-rate | L2 Finance | Company Flow outputs (→) |
| Revenue per channel; demand vs capacity | L2 Deploy | Watch "capped" chips |
| Valuation, sector value, market mood, your share and its drivers, investor credibility factor, governance factor | L2 Finance › Story | Raise card, Ownership (→ Story) |
| Rival private labs' valuations and shares | L2 Finance › Story (share bar hover) | — |
| Ownership, board seats, board confidence, votes, charter rights | L2 Finance › Board & owners | Major-decision cards (vote strip) |
| Parent budget, parent confidence (division) | L2 Finance › Cash (Parent budget card) | Top strip cash chip, Board (→) |
| Raise ceiling and its limits; ask; IPO | L2 Finance › Cash › Raise | Story footer (→) |
| Promises and credibility score, tranche conditions, covenants, contingent liabilities (RVGs, litigation), parent goals | L2 Finance › What we owe | Watch "owe" alert |
| Commitment ledger (8 q), contracts | L2 Finance › Contracts | — |
| Debt, rating, covenants' terms, lease rate | L2 Finance › Debt & partners | — |
| Hype, bubble, rates, investor pool, IPO window | L2 Finance › Story (Markets card) | — |
| Partner offers, signed partners and their strings | L2 Finance › Debt & partners | Queue alert |

### Company, compute and people

| Datum | Home | References |
|---|---|---|
| Compute online; owned vs rented | L2 Company › Flow | — |
| Idle chips (no rack space), installing, empty racks ahead | L2 Compute › Overview verdicts | Company › Flow red band (link, no number); watch chip → Compute; Sites tab badge |
| Capacity and fleet forecast | L2 Compute › Overview chart | — |
| Pools by use (training, experiments, …) | L2 Company › Flow | Split tab (percent shares are the control) |
| Compute split % | L2 Company › Split | — |
| Research speed M, binding input, best levers | L2 Company › Flow, Research speed card | — |
| Headcount, hiring target, pipeline, payroll, morale | L2 Company › People | Watch (morale < 40) |
| WSL, target, siloing, counter-intel, security spend | L2 Company › Security | Risk theft row (→) |
| AI labour (agent copies, AI FTE) | L2 Company › People | — |
| Vendor fill | L2 Compute › Overview verdict | — |
| Chip supply, prices, order weight, export policy | L2 Compute › Market | — |
| Orders pipeline, cloud contracts | L2 Compute › Orders | — |
| Sites (stage, MW, ETA, risk), MW used/cap, grid, transformers | L2 Compute › Sites | Forecast chart events |

### Models

| Datum | Home | References |
|---|---|---|
| Lineage, version status, internal flag | L2 Models › Lineage | — |
| Model card: measured L per version, domains, benchmarks, monitorability, serve cost, flags | L2 Models › Card | — |
| Trait beliefs per version | L2 Safety › Graph (pills) | Models card (→ Safety) |
| Run queue and progress | L2 Models › Runs in progress | Bottom bar (none) |
| Next-model gates (train days, data, power, cash) | L2 Runs header | — |
| Run prediction (band, domains, ETA, cash, signals, trait pressure) | L2 Runs | — |
| Paradigms | L2 Models › Paradigms | — |
| Deployments, price, KYC, serving share, leak | L2 Deploy | — |

### Safety

| Datum | Home | References |
|---|---|---|
| Trait graph, beliefs, edges, evidence | L2 Safety › Graph | — |
| Detection by capability level (heat grid) | L2 Safety › Graph side card | — |
| Estimated misalignment band, danger line | L2 Safety › Graph side card | Risk own-models row (driver) |
| Agenda portfolio, funding, efficacy band | L2 Safety › Agendas | — |
| Techniques, strength curves, decay, masks | L2 Safety › Tools | Watch "tool decayed" chip |
| Eval gate, runtime monitoring, publish policy, pledge | L2 Safety › Tools (policy card) | Deploy gate reason (→) |
| Incidents and responses | L2 Safety › Incidents | Queue alerts |
| Findings, failure-mode cards | L2 Safety › Findings | Nav badge (new findings) |
| Investigations | L2 Safety › Incidents | — |

### Relations and world

| Datum | Home | References |
|---|---|---|
| Counterparty trust, access, favors, dependence | L2 Relations › Counterparty cards | — |
| Credibility, scrutiny, approval, concern | L2 Relations header | Watch |
| Blocs | L2 Relations › Blocs | — |
| Commitments (obligations) | L2 Relations › Obligations | — |
| Government and China ladders, statutes, nationalization | L2 Relations › Government · China | — |
| Research bodies | L2 Relations › Research bodies | — |
| Sector automation (A, A*, F, binding) | L2 World › Automation spread | — |
| Jobs and macro | L2 World › Jobs, Macro | — |
| Control index and leverage | L2 World › Control index | — |
| Technology tree, moonshot | L2 World › Technology | — |
| Headlines | L0 queue (latest) | Hover (list) |

---

## 3. Drill-down paths

| Question | Path |
|---|---|
| Why is understanding falling? | Race (L0) hover → detection bars and why-moved → click → Safety Graph → hover a hidden-behaviour pill → upstream edges and evidence card → lever "Re-validate" → Tools tab |
| Am I running out of money? | Cash chip (L0) gauge → hover → burn by category → click → Finance waterfall → hover the chips bar → ledger lines → Locked-in spending |
| Who is about to beat me? | Lead chip (L0) → click → Overview lead track → hover a lane → click → Relations |
| What should I do now? | Overview Watch → Go → the panel scrolled to the control, pulsed once |
| What does this choice do? | Decision chip (L0) → modal → choice cards with before→after bars → "Lasting fixes" Go buttons |
| What will this run produce? | Runs → option tiles (effect glyphs) → hover an option → trait arrows and main path → Launch |
| What is a covenant? | Any dotted term → tooltip → nested terms (L3) → Codex for the full entry |

---

## 4. Implementation notes

- **Homes are marked in the DOM.** Every home element carries `data-home="<datum id>"`, and every reference chip carries `data-ref="<datum id>"`. `scripts/v2/uitest.mjs` fails if:
  - a datum id has a home on two screens (the shell counts once);
  - a datum id has two homes on one screen.
- **Terms.** `Term` renders `data-term="<id>"`. If the id is missing from the glossary it adds `data-term-missing`, which uitest fails on. `scripts/v2/lint-glossary.ts` checks every `Term id`, `[[link]]` and required term in source.
- **Go.** `store.goto(panel, anchor, tab?)` opens the panel and tab, scrolls to `#ctl-<anchor>` and pulses it.
- **Watch rules** live in `src/ui/v2/shell/watch.ts` and are UI-only. Inputs are visible selectors only (lint-hidden covers `src/ui/v2`).
