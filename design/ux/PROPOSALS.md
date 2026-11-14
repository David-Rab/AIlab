# v2 redesign proposals

Mockups are static HTML/CSS/SVG in `design/ux/mockups/`. Each `.html` is self-contained (inline lucide sprite) and uses `kit.css`; the `.png` files are Edge renders.

**Data.**
- Numbers come from a real day-700 state: seed 2027, ai2027 preset, mixed bot, Act 3. The company is renamed "Halcyon" to avoid the rival-name collision noted in the audit.
- **Engine-computed:**
  - run predictions (`runCard` sweeps);
  - detection-by-level (`understanding()` at L 6…14);
  - the cash cause strip, risk sources, flows and edges.
- **Illustrative, needing the selectors in PLAN §B:**
  - the "why it moved" values in the U tooltip;
  - the what-if values in the Company hover;
  - the demand curve in the decision modal;
  - the quarter recap deltas.

| Mockup | File |
|---|---|
| Design system sheet | `00-design-system.png` |
| Main screen | `01-main.png`; hover state `01b-main-hover-why.png` |
| Company flow | `02-company-flow.png`; hover state `02b-company-flow-hover.png` |
| Run designer | `03-run-designer.png`; option preview `03b-run-designer-hover.png` |
| Safety lab, trait graph | `04-safety-lab.png` |
| Decision modal | `05-decision-modal.png` |
| Finance | `06-finance.png` |
| First 15 minutes | `07-onboarding.png` |

---

## 1. Main screen (`01-main.png`, `01b-main-hover-why.png`)

### Top strip: one hero, six chips
- **RaceMeter** (470 px):
  - capability (violet) and understanding (teal) on one 5–15 scale;
  - milestone ticks;
  - the gap hatched red with a "2.0 BLIND" tag (or green "1.7 AHEAD");
  - 90-day trend per side.

  This is the Plague Inc "infection vs cure" pair, and nothing else in the strip competes with it.
- **Catastrophe risk** gauge (34%, band 9–71) is new at Level 0. It is the outcome the game scores.
- **Cash · runway** shows `$25B 3.5q` plus 8 quarter pips coloured by the live state thresholds.
- **Compute** shows `8.5M` plus a `2.7M idle` warning suffix.
- **Lead · nearest** shows `+203d DeepCent`, with every lab in the hover.
- **Scrutiny** shows its trend.
- **Removed from Level 0:** the R&D multiplier (moved to the rail as "Research speed") and the act chip (under the date).
- **Time controls:** labeled speed buttons with key hints, plus "FF to …".

### Centre: "Overview", with tabs Race · World · Flows · Risk
- **The frontier track** replaces the node map's dead space:
  - one lane per lab, its token at the estimated level with an intel-error whisker;
  - milestone columns;
  - your Understanding line;
  - the hatched unverified zone right of it;
  - lead and Index grade per lane.

  It answers in one glance who is ahead, by how much, and how far past what we can verify.
- **Race history:** L and U over the whole game, with the gap shaded and model releases marked. The player sees *when* the gap opened (here, at the switch to Atlas-3.0).
- **Automation spread** (Plague Inc's spreading map, done as region × sector tiles): US / China / RoW × 14 sectors on a sequential teal ramp. It sits with "Your models in use" (per channel, with a "capped" tag) and jobs indicators.
- **Where risk comes from:** ranked bars of the catastrophe-risk sources (war 12.5%, your models 10.4%, DeepCent 7.9%, …). It sits with the **control index** (stacked by lineage, labeled leverage thresholds).
- **Flows tab:** today's node map, kept for theft, distillation and talent, with labeled edges.

### Right rail: "what limits me, what is wrong, who is close"
- **Research speed:** a chain `8.5M compute → 1.65M experiments (binding) → 5.8× R&D`, with levers ranked per dollar (`+10% experiments → +4.5%`), each a Go link. Staff shows "saturated" instead of a silent +0.0%.
- **Next model · Atlas-4:** four icon gates (train 97 d binding, data 13.7×, power 3.0 GW, cash 19%).
- **Watch:** rule-generated CauseChains, each with a Go button:
  - `2.7M idle ← no power → Sites`;
  - `3 channels capped ← serving 17% → Split`;
  - `Power seeking 37% ← tool 88% decayed → Safety`.
- **Rivals:** monogram, lead bar and Index grade.

### Bottom
- Decision chips with ring timers.
- Collapsed alert chips ("5 findings · 2 new").
- A run progress chip.
- One ticker line, with no repeated or failed-action lines.

### Hover state
Hovering Understanding opens the WhyCard with three sections:
- detection per critical trait vs 50% (3 of 6 now under);
- why U moved over 90 d (decay, agent switch, agendas);
- lever buttons.

It also lights the race meter, the Safety nav item and the matching Watch item.

## 2. Company: the four spheres as a diagram (`02-company-flow.png`)

- A live Sankey per quarter:
  - **Money:** revenue $31.2B plus $11.3B from reserves → cash out $42.5B → chips / cloud & leases / sites & power / payroll.
  - **Compute:** at the `$ → H100e` boundary, flows convert into compute online (8.5M), **idle · no power (2.7M, red)** and staff.
  - **Departments:** compute splits into Capabilities 5.9M / Product 1.46M / Safety 1.02M / Security 0.08M.
  - **Outputs:** Atlas-3.0 L 10.2 · revenue $125B/yr · Understanding 8.2 · WSL 4.9.
  - A dashed **revenue loop** returns to cash ("capped by serving capacity").
- Binding markers sit on the bands: "compute-bound: experiments", "capacity-bound", "fix: Sites › power", "2.0 behind capability".
- **Sphere cards** below show the same four colours, with KPIs and a status tag each.
- **Hover a node** to dim everything else. A what-if card shows, for example, "+5 pts serving → +$36B/yr; −0.7× R&D if taken from experiments; or power the idle chips +32% compute", with Go buttons to the split and Sites.
- Tabs: **People** (headcount, hiring pipeline, morale per sphere) and **Compare 90 d** (ghost widths from a quarter ago, so change is visible as a shape).

## 3. Models and Run designer (`03-run-designer.png`, `03b-run-designer-hover.png`)

### Recipe column
- Plain-language rows replace `A…H` engine ids: Rewarded for, Practise on, RL intensity, Chain of thought, Safety training, Inoculation, Compute.
- Each option is an **OptionTile** with its own effect glyphs, computed against the reference recipe:
  - `Heavy, cheap graders: $0 · RH ▲▲▲`;
  - `Light: L −0.5 · 35 d · $0`;
  - `Pressured CoT: OBF ▲▲▲ · serve −20%`.
- Locked options show why ("needs P23", "needs latent base").
- The compute slider shows ETA at its ends.

### Predicted model
- A level ruler with "now 10.2" and the predicted band "10.6–11.1 (+0.7)" against milestones.
- A domain radar: the prediction band against the current model (dashed). Domain icons carry a delta, and dangerous-capability crossings are circled.
- A timeline: training 97 d plus evals 15 d, alongside the running post-40.

### What this recipe pushes
- Training-signal bars, with the reference tick and the delta.
- **Trait arrows** derived through the trait graph (first plus second order, with edge id and grade): reward hacking, persona, proxy, concealment, alignment faking.
- A **Main path** CauseChain with citations (METR 2025, MacDiarmid 2025).

### Compare strip and Launch
- Capability ≈ same · cash saves $2.4B · ready Sep 6 · reward hacking ▲▲▲ · monitorability high · obligations 0 broken.
- **The trade-off is legible before launch:** the cheap recipe saves $2.4B for the same capability and buys reward hacking.

### Hover state
Hovering "Engagement" previews `S1 0.4→0.9 → Sycophancy ▲▲ → RH ▲` with edge E01 (grade A) and its citation.

### Models panel (no mockup, same kit)
- Lineage becomes a horizontal node timeline: bases as lanes, versions as dots at their measured L, deploy and internal badges.
- The model card has three parts:
  - a large radar against the previous version;
  - the 5 headline benchmarks with saturation marks (the rest under "more");
  - a severity-coloured trait belief strip.
- The 13 action buttons become 4 grouped menus: Use · Evaluate · Variants · Retire.

## 4. Safety lab (`04-safety-lab.png`)

### Trait graph (first tab)
- Layers: **training signals → learned → awareness → hidden behaviour → tools see**. Protective traits sit in their own box.
- Nodes are pills with an icon, the estimate, and a ±uncertainty band in severity colour.
- Edges: width = weight, dash = evidence grade (A solid … D dotted).
- **Hovering a node lights its upstream paths** with edge ids and grades. The evidence card holds:
  - the belief;
  - detection vs 50%;
  - each incoming edge with its citation;
  - levers: Investigate · less long-horizon RL · fund AI control.
- **Overlay:** the signals of your next run's recipe, so the run designer and the graph tell one story.

### "Can your tools see it?"
- A heat grid of the 6 critical traits × capability level L6–L14.
- Values are engine detection probabilities; your level is outlined, and the 50% boundary is the definition of Understanding.
- The root cause is underneath as a chain: `Control eval 88% decayed → 3 traits under 50% → Re-validate`.

### Rest of the lab
- **Estimated misalignment:** a band against the published 0.40 danger line, with an explanation of why the band is wide.
- **Agendas:** the 7 funded ones as rows with funding pips, an efficacy band and finds/yr; "+12 unfunded" opens the portfolio tab. The 19-row table with duplicate Fund/Cut controls goes.
- **Other tabs:** Agendas · Tools (strength-vs-capability curves as small multiples with M½ marked) · Incidents (cases with timers and the §3.5.9 response menu as ActionCards) · Findings (type icon chips; publish as a batch action).

## 5. Finance (`06-finance.png`)

- **Runway gauge:**
  - zones distress < 3q, tight < 6q, healthy;
  - a needle at 3.5q;
  - a "Tight on Jul 1" tag;
  - liquidity, net burn and the dry-date.
- **Vertical waterfall:** revenue +31.2 → payroll −6.3 → cloud −11.4 → chips −17.6 ("41% of spend") → sites −7.1 → **net burn −11.3**.
- **Cash chart:** history with raise markers, plus two projections (no new money, and the pending $33B round), showing the cash-zero date.
- **How much can you raise:**
  - the three limits as bars, with the binding one in amber ("bound by annual cap $68B");
  - an ask slider whose pills show stake, runway gained and close chance.
- **Locked-in spending:** 8-quarter firm vs cancellable bars against the revenue line ("revenue covers it 2.7×").
- **Why cash moved · 30 d:** the cause ledger as diverging bars with plain labels and details.
- **Board:**
  - seats as avatars with their headline stance;
  - confidence with its trend;
  - an ownership donut in the four sphere hues (validated adjacent order);
  - markets: hype, bubble index (amber), rates.

## 6. World (no full mockup; the kit is shown on the main screen)

- **Sector map:** the region × sector tile grid from the Overview, at full size.
  - Each tile shows A%; a corner glyph shows the binding constraint (`d` demand / `c` capability as an icon); hover shows A, A*, F and employment.
  - A **time scrubber** replays spread over the game (the series exists weekly).
  - Your deployed channels draw "reach" arcs onto the sectors they serve.
- **Control index:** four domain bars stacked by lineage, with labeled leverage thresholds (2% / 5% / 10%) and your share as a hero number. Hover lists each lab's share and the tier.
- **Jobs strip:** unemployment per region as sparklines; youth and displaced counts; the transition fund as an ActionCard with before→after on approval and unemployment.
- **Tech tree:** a dependency graph (prereqs as edges), state colours (discovered / ramping / available / locked) and risk icons. A moonshot is an action on the node.

## 7. Decision modals (`05-decision-modal.png`)

- **Header:**
  - sphere icon and tag;
  - the title plus one sentence;
  - a **ring timer** (3 d).
- **Why this happened:**
  - the CauseChain `2.7M H100e idle · no power → serving gets 17% → 3 of 3 channels capped → demand +30% unmet`;
  - a demand-vs-capacity sparkline;
  - one line of context.
- **Choice cards (keys 1/2/3):**
  - icon and verb;
  - one line of intent;
  - **before→after mini-bars on each touched meter** (cash, revenue, serving, approval), so "$1.0B" reads against $25B;
  - a recurring or lagged note;
  - the default card marked "happens on its own in 3 d".
- **Lasting fixes:** Go buttons to the real controls (more serving, power the idle chips, distill a mini). Events teach where the levers live.

## 8. First 15 minutes (`07-onboarding.png`)

1. **0:00, the one thing to watch.** Spotlight on the RaceMeter; coach card "Keep understanding ahead" (violet = capability, teal = what your tools can read); Next / Skip all.
2. **0:30, the first run, as a goal not a step.**
   - The Runs nav item pulses.
   - A starter recipe card shows `L 5.2 → 5.6 · 35 d · Sycophancy ▲` and a Launch button.
   - The coach says "try one change and watch the arrows".
3. **3:00 (day 45), the first dilemma, scripted and concrete.**
   - "Atlas-1.1 flatters raters".
   - The CauseChain `S1 rater approval → Sycophancy 0.24` from your own recipe.
   - Three ActionCards: Disclose / Fix quietly / Deny, with the ×3 trust exposure visible.
4. **8:00 (day 92), the quarter recap.**
   - Auto-pause; capability, understanding, cash and lead before→after, each with its top cause.
   - "New this act: Relations"; "next unlock at L 6.5".

**Goals rail (persistent, collapsible).**
- Six Act 1 goals: read the race · launch a run · FF to the result · decide the finding · check runway · ship to a channel.
- Unlocks-next list with its triggers.
- A controls card (Space, 1–4, F, hover = why, click = go, Alt = pin).

Goals unlock through the model and agenda tree, as in Factorio. Nothing is forced.
