# Research screen: IA note

Files: `v3-research.html`, `v3-research.png` (main), `v3-research-node.png` (L2 node card: Anti-scheming training), `v3-research-assign.png` (team picker with the ×1.5 specialty bonus and a nested ETA tooltip).

First glance (L1, three visuals): **know-how bar** (header), **the tree** (focused view), **active projects + queue**.

## How the tree stays legible
- **Focused view, not the whole tree.** The view shows depth 1–3 around the active projects. Depth 0 appears only as a "known" column of small pills, and only for prerequisites of what is on screen. The minimap (tree header) shows all 88 ideas, with the viewport outlined. Zoom and pan reach the rest.
- **The six "columns" are drawn as horizontal lanes.** TECH-TREE asks for both "six columns" and "left → right by depth". Depth runs left → right, so the specialties must be bands. The capability lanes take a violet tint and the safety lanes a teal one (sphere hues), and each lane is told apart by its icon and label.
- **Node = 2 lines.** Line 1: state icon and name. Line 2: effect arrows (brain = capability, microscope = safety; ▲ gain, red ▼ cost), layer badge B/T/S/L, then effort and odds for capability nodes not started, effort only for safety nodes (their odds are a research line's health, whose home is Safety), or the missing prerequisite for locked ones. Everything else is in the node card (L2) or tooltips (L3).
- **Known nodes are small, the frontier is big.** Active nodes are blue with a progress ring and bar, queued ones amber with a queue number, locked ones dashed with a lock. A failed idea is a red pill.
- **Lines.** Missing prerequisites are amber dashed (the locked reason). Satisfied prerequisites are grey, and faint when they cross lanes, to avoid spaghetti.

## Datum → level → home

| Datum | Level | Home | Elsewhere |
|---|---|---|---|
| Know-how in best model vs not yet trained in (+2.6 mo) | L1 | Header know-how bar | "Train ›" links to Models. "Behind at finish" for a blueprint is a separate Models datum |
| Research speed 1.9× and bottleneck | — | **Company** | Link chip "Research speed ›" only |
| Idea state (known / open / active / queued / locked / failed) | L1 | Tree node | — |
| Capability and safety effect direction | L1 | Tree node arrows | Exact effects → node card (L2) |
| Layer (Backbone / Training / Scaffold / Lab) | L1 | Node badge | What a rebuild needs → node card |
| Effort of ideas not started; odds of capability ideas | L1 (quiet) | Tree node | Node card shows team-months and an ETA estimate |
| Safety-line health (Promising / Mixed / Struggling) | — | **Safety › Research lines** | Project cards and the node card show it only as the odds, as a link chip to Safety. No band and no result history here |
| Missing prerequisite | L1 | Amber line plus "needs …" on the node | Node card "Needs" |
| Active project: teams, specialty bonus, progress, ETA, odds (or a line-health link) | L1 | **Project card** | The tree node shows only an unlabeled progress ring and bar (a reference) |
| Queue order and what each item waits for | L1 | Queue card | The tree node shows the queue number as a marker |
| Auto-assign idle teams | L1 control | Projects bar | — |
| Failed idea, retry date, retry odds | L1 pill / L3 | Tree pill (red) | Retry 14 Aug 2026 at 30% in its tooltip |
| Last result (Linear probes: works well) | L0 → L3 | Alerts list (top strip, one alert channel) | Safety research lines (as a result pip) |
| Node card: effects with numbers, side effects, odds (a line-health link for safety nodes), effort, prerequisites, unlocks, how to use it, what offsets the side effect | L2 | Node card | — |
| Assign preview: bonus ×1.5 / ×1.0, ETA before → after, cost to the project the team leaves | L2 | Team picker | ETA breakdown (capacity, √ rule, research speed) → tooltip |

## Demoted on purpose
- Agenda ids, paradigm ids, priors, engine terms (Δp, U-modes) → node card or tooltip.
- Whole-tree view → minimap and zoom. Per-specialty team counts → Company.
- The "Last result" line is not shown on screen. It lives in the Alerts list (the one alert channel).

## Glossary terms needing tooltips
Know-how · trained in · research speed · depth · layer (Backbone, Training, Scaffold, Lab) · effort (S/M/L/XL) · team-month · odds · research line · Promising / Mixed / Struggling · specialty bonus · diminishing returns (√ capacity) · queue · auto-assign · retry rule · every node name and trait named on a card (Scheming, Eval awareness, …).
