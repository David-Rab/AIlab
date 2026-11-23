# R&D UI: information architecture (revised 2026-11-23)

good-ui step 2 (after `ui-audit/UI-AUDIT.md`, before mockups). Replaces the previous draft (in git).

**Authority, in order:** SESSION-HEAD [16]–[32] and Part 2 → DECISIONS.md (UI-IA open questions, Vocabulary, DD-01..21,
OD-1..11) → VOCAB.md (the only words used here) → good-ui skill → UI-AUDIT → SAFETY-REDESIGN.

**Rules applied:** clear information first; organise by the player's questions, not the engine; player words only;
designed fresh, not from the current screens. Tabs per [32]: COMPUTE · LAB · RESEARCH · TRAINING · MODELS · PRODUCTS ·
SAFETY.

**Levels:** L0 always visible (≤ 7) · L1 2–4 visuals per screen · L2 click (panel, card, drawer) · L3 hover (tooltip,
Codex).

**Basis** (every datum has one; never hidden truth):
- **F** = fact: owned, spent or counted.
- **M** = measured: by evals or observation, shown with a range.
- **B** = belief: the lab's estimate from evidence, shown with a range. Forecasts (**B·fc**) and intel on rivals
  (**B·intel**) are beliefs too.

**Provisional:** SAFETY and PRODUCTS rows wait on engine work (SR-17..24, Phase 7). Their words and readouts may change.

---

## 0. L0 shell (every screen)

| # | Item | Shows | Basis | Click → | Why it is L0 |
|---|---|---|---|---|---|
| 1 | Clock | date, pause, speeds | F | — | Runs, deliveries and research all happen over time |
| 2 | Navigation | 7 R&D tabs + Overview, Finance, World, Codex. One badge per tab, counting only things that need the player: LAB short / idle · RESEARCH result / failed · TRAINING run done · SAFETY incident / hold | F | the tab | Where things are |
| 3 | Alerts | one channel with severity levels; duplicates collapse; each alert links to the home of its cause | F | the cause's home | The only interrupt |
| 4 | Cash · runway | `$51.6B · 8 quarters`; revenue and burn in the tooltip (Q1) | F; runway B·fc | Finance | The hard limit on every buy and hire |
| 5 | Lead · nearest | `−154 d · Meridian`, with a range on hover | B·intel (DD-10 measure) | Overview lead lanes | The race: the game's win/lose axis |
| 6 | **Research speed** | `×3.1`, trend arrow. Tooltip: "× the leading lab, Jul 2025", AI's part ("×1.4 from AI staff"), 90-day sparkline | B | RESEARCH › Portfolio header | AI 2027's central quantity, the takeoff. It is the one number that sums people, AI staff and compute, and it moves daily. Today it has no reachable home (audit B3) |
| 7 | Loss-of-control risk (small) | `9% (3–24%)`, or **Unknown** when the range is wider than 30 pts; "if it could act now" in the tooltip | B | SAFETY › Risks | Designer decision: the other side of the tension. The full gauge lives only on SAFETY |

Help, settings and the menu are chrome, not information.

**Taken out of L0:**

| Item | Goes to | Why |
|---|---|---|
| **Compute online** | COMPUTE L1 (forecast, "now" point) | It changes only when deliveries land, and the alert channel reports those. Buy and build decisions are monthly. Research speed and runway already carry its effect |
| Capability `6.8 [evaluating]` + sight-limit race bar | MODELS card (skill bars); sight limit on the SAFETY header | Audit: it showed the internal model, contradicting "best" and the prediction (three numbers); the −6.8 badge was unlabelled |
| Catastrophe risk gauge | Replaced by #7; world risk on the World screen | Audit: 27% here vs 0.0% loss-of-control: two stories |
| Revenue · 30 d | Cash · runway tooltip; Finance (Q1) | Keeps L0 at 7; runway already reads revenue |

---

## 1. Tabs: questions, L1 visuals, L2

★ = mock up first (§6).

### COMPUTE: buying and building only

| Player's questions | L1 visual | Data |
|---|---|---|
| How much compute do I have now, and in 6, 12 and 24 months? | **Capacity forecast**: stacked area of online H100e (owned / rented); ordered and building as dashed bands | F now; B·fc ahead; rivals' compute as right-edge ticks (B·intel, L3) |
| What stops me growing faster? | **Bottleneck verdicts**: 3–4 chips (`Power: 2 sites wait for the grid`, `Unracked chips: 4k`), each linked to its fix | F |
| What does this order or site give me, when, and at what cost? | **Order pipeline timeline**: deliveries and site stages on a time axis; every buy previews before → after on the forecast | F / B·fc |

L2: Sites · Orders · Market tabs. COMPUTE never shows how compute is *used*: that is LAB.

### LAB: who and what works on what ★1

| Player's questions | L1 visual | Data |
|---|---|---|
| Where does my compute go? Is any of it idle? | **Compute allocation bar**: one flat bar, one segment per use (Training · Data generation · Research experiments · AI staff: engineering / experiments / ideas / safety · Safety work · Safeguards · Products), **Idle** hatched inside each segment plus one total. Presets: Default · Race · Balanced · Safety-first. Drag to set, with a before → after preview on the receiving use | % · H100e, F |
| Who works on what, people and AI? Where are we short? | **Workforce board**: columns Engineers · Research engineers · Scientists, in two bands (Capability / Safety). Each column reads top to bottom: People (teams, quality) → AI staff (model, copies, AI share) → Total effort (× the people alone) → Needs in priority order (gets / needs bars, short in amber, **Spare** or **Idle** last). The Scientists column holds the capability / safety split handle (OQ-2) | F; AI share M |
| What would more of anything buy? | **Best moves**: a ranked list of the 5 best marginal moves, mixing compute and hires (`+10% to Research experiments → research speed +6%`, `+1 research-engineer team → run operations 70% → 100%`), each with a Do button (preview, then commit) (Q6) | B (believed parameters, OQ-5) |

L2:
- Hiring drawer: hiring target, offers, star hires, open positions, payroll.
- Needs order editor, including the safety research engineers' order (OD-9).
- AI staff detail: cost per hour of work, research taste (L3), AI share allowed and spot-checks for safety work (the Safety work package).
- Auto-split idle compute policy, with its last move.
- Segment detail: the sub-uses of Safety work; Safeguards is read-only here ("set by safeguards ▸").

### RESEARCH: Portfolio · Discoveries · Know-how

**Portfolio ★2**

| Player's questions | L1 visual | Data |
|---|---|---|
| Is research going well? What is slowing it? | **Limited by** strip: four segments (compute · research engineers · scientists · idea quality), the binding one lit; the chip jumps to the LAB best move. Shows a verdict only, no numbers (those live in LAB). A red state when an input is zero (fixes the silent stall, B10) | B |
| What finishes next, and what will it give me? Is safety keeping up with capability? | **Portfolio board**: two columns side by side, Capability and Safety, each in priority order (drag). One card grammar: name · `ongoing` / `one-off` chip · output tag (capability / see / stop / fix) · stage track (Ideas · Small test · Big test · Build-in; projects Test · Build-in; safety adds Validate) · **next result in ~N d** · expected effect where it lands (`+1.5% pretraining (0.5–3%)`, `new instrument: internals`, `unlocks Mixture of experts`) · chance it works (project) / returns falling (programme) / outlook (safety programme) · teams. A per-card "Limited by" appears only when it differs from the strip | F stage, teams; B ETA, effect, chance |

L2, the project card:
- the idea under test, in words;
- **Gets**: staff and compute;
- teams wanted, and why this team;
- idea choice: Safe / Balanced / Bold;
- ideas tested and dropped, and how each behaves at scale;
- where it takes effect;
- failed, with retry at lower odds;
- for safety programmes: expected vs observed results / yr.

**Discoveries**

| Player's questions | L1 visual | Data |
|---|---|---|
| What can I unlock next, and what does it need? | **Discoveries tree** by field (Pretraining · Post-training · Systems · Alignment · Interpretability · Evals & control). Capability and safety share one tree. Each node: name, state word (Known · Available · Locked (needs …) · Queued · Researching · Failed), one effect chip. "Available" filter. A Researching node links to its Portfolio card, which is the home of its stage and ETA | F state; B effect |

**Know-how**

| Player's questions | L1 visual | Data |
|---|---|---|
| How much better is our know-how than at the start, and than public know-how? | **Five area bars** (Pretraining recipe · Post-training method · Post-training ceiling · Training efficiency · Serving efficiency): × vs Jul 2025 on a log axis, **Public know-how** \| **Yours** (with a range whisker) | Public F; Yours B until measured (F8.1) |
| How much is waiting for my next model? | On each bar, the **Waiting** part (`×2.2 waiting`) as a hatched end; it can never exceed Yours. Chip → TRAINING › Next run | B |

L2:
- the idea list per area, each idea as "+1.3%";
- know-how growth (× per year);
- measured effect, per model (F5: evals measure models, not single ideas);
- domain effects;
- publish policy;
- **Lab tools**: the internal tools you own (coding harness, research harness, memory). For each: what it helps (the AI staff job it lifts and by how much), build time, upkeep. They sit here as owned built things (DD-03); the build itself runs in LAB's build queue.

### TRAINING: Next run · Data · Environments · Runs

**Next run ★3**

| Player's questions | L1 visual | Data |
|---|---|---|
| What model will this run give me? | **Prediction**: the skill bars of your best model (named) with ghost extensions per domain (range), the median-expert / best-human / superhuman ticks, and the milestone it would meet. The planned run's **sight limit** is a tick on the same ruler | B·fc |
| What do I choose? | **Run plan in two stages**: Pretraining (new · continue · distil; size; data mix) → Post-training (focus, budget, environments, methods). Every option row has Skill · Time · Cost · Serving cost · Risk; the default option is "Standard" | F choices; B effects |
| When will it finish, at what cost, and what holds it back? | **Limits strip** above Launch: Compute (days at the current training share) · Time · Data (re-reads) · Cash · Run operations. Each gauge says enough / short, with a chip to its home | F / B·fc |

L2:
- **Pushes** per risk family, and each ticked method's predicted change (pts), with its believed strength "tested up to …";
- cost breakdown, setup time;
- the launch snapshot (frozen) of a launched run.

There is no allocation control here: the training share is a link to LAB, plus a preview line ("at 60%: 70 d").

**Data**

L1 visuals:
- **Data by domain**: tokens, stacked by source (Public web · Licensed · Usage · Generated · Expert), against what the next run will draw, with re-reads marked. Verdict: enough / short.
- **Generated data jobs**: teacher (model name), yield, H100e-days.

L2: licence offers, quality, data mix vs Standard. The data-generation share is a link to LAB (the old "Pool share" control is removed).

**Environments**

L1 visual: a **family grid**. Per family: Realism bar, Loopholes %, a "used by next run" marker, and the next run's **Hacking pressure** (low … high). Expand · Harden carry previews.

L2: expert data, build history. Families with no environments show as empty, not hidden (DD-07).

**Runs**

L1 visual: **runs timeline** (Gantt). Running and queued runs, continual learning as a scheduled row, auto-distils tagged "auto". Each has an ETA and a stall reason in amber.

Done runs → MODELS card. This fixes the audit's stale runs list.

### MODELS: what you own and how good it is

| Player's questions | L1 visual | Data |
|---|---|---|
| What models do I own, and what does each do? | **Family tree**: every real model (full, distilled, older, post-trained) by size. State words: Testing · Ready · In use · Retired · Rolled back. Role chips: AI staff job, product lineups. Retired models fold away | F |
| How capable is each, and how sure am I? Which milestones has it met? | **Model card**: one skill bar per domain (Code · AI research · Math & reasoning · Long tasks · Social · Media · Cyber · Bio · Physical) with median-expert / best-human / superhuman ticks and a range; **milestone ladder** (Agent … Superintelligence), each with its date met. A rival tick appears per Q2 | M |
| What is being tested, and when do I know? | **Evals** sub-tab: queue timeline (model, depth, time to finish), the "Re-test when" policy | F |

L2 (card):
- benchmarks (score, Maxed out);
- jobs: skill at this job, can do alone, time horizon (home of "how close AI is to each job"; LAB shows the AI share it produces);
- cost per hour of work, size;
- what it was trained with: methods, data, the know-how snapshot;
- actions: release open weights, retire.

### PRODUCTS: models + tools + markets (provisional)

| Player's questions | L1 visual | Data |
|---|---|---|
| What does each product earn, and what limits it? | **Revenue by product** bars, each with a "Limited by" chip (serving compute · quality · price · demand) | F; limit B |
| What does each product sell, to whom, and with which models and tools? | **Product card**: Lineup (models by name, share of hours), Tools, Sector certifications ("certified on" date), Price (Low / Standard / Premium), Thinking effort | F |
| Can I serve the demand? | **Served vs unserved** bar per product | F served; B·fc demand |

L2: customers and market share target; hours of work sold and seats; price vs the best rival's (B·intel); "Serve the most profitable first"; "Auto-make smaller sizes" (the runs it creates show in TRAINING › Runs); usage policy.

The serving share is a link to LAB. Safeguards and customer checks are a link to SAFETY › Safeguards.

### SAFETY: Risks · Model · Instruments · Safeguards · Incidents & cases (provisional) ★5

**Header** (all SAFETY tabs, L1), for the model picker's model (default: your riskiest running model):
- **Loss-of-control risk** gauge;
- **Unstopped harm / yr** by severity;
- **sight limit** as a tick against this model ("1.2 levels short of Atlas-4");
- the framework's current **Hold**, with [why].

| Tab | Player's questions | L1 visual |
|---|---|---|
| Risks (first, OD-10) | What could it do, what stops it, and what gets through? | **Act table** grouped Misbehaviour · Against the lab · Misuse by people. Columns: Would try · Able to · Chances · Stop rate · Unstopped / yr, sorted by unstopped. Footholds line at the foot (shown once one is suspected) |
| Model | What do I believe this model is like, and how sure am I? | **Four risk-family bars** (best guess + range), **Unknown** chips, In tests vs In real use gap |
| Instruments | How far can I trust what I see? | **Reliability grid**: instrument × selected model (solid = validated, dashed = extrapolated) with warning chips (notices tests · trained against · not ported · disagreement); Validate buttons with previews |
| Safeguards | What stops acts, at what cost? | **Per deployment** (each product and each AI staff job, OQ-7): safeguards with stop rate per act, Slowdown, compute; edit in place with before → after on the act table and the header. "Required by framework" marks |
| Incidents & cases | What happened, and how do I learn more and fix it? | **Incident cards** (severity word, apparent cause, deadline, link to the act row) and **case cards** (question, progress, AI share, verdict) |

L2:
- the evidence list per trait;
- the sight limit's detection grid (trait × level) and its history: the old race chart lives here;
- the validation queue (instruments and methods);
- the Safety framework editor;
- disclosure policy;
- foothold cards;
- cause-aware responses.

Safety staffing appears as one link chip, `Safety staff: short ▸ LAB`, with a verdict word and no copied numbers. It replaces the capacity strip.

---

## 2. IA map: every R&D datum → one home

Columns:
- **Home**: tab › place · level.
- **Unit**: per VOCAB §1.
- **Linked from**: link chips elsewhere, never copies.

### COMPUTE

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Compute online, owned / rented | COMPUTE › forecast · L1 | H100e | F | LAB bar total |
| Forecast: ordered, building | COMPUTE › forecast · L1 | H100e by month | B·fc | — |
| Rivals' compute | COMPUTE › forecast ticks · L3 | H100e (range) | B·intel | — |
| Unracked chips, power waits | COMPUTE › verdicts · L1 | count · days | F | Alerts |
| Orders, cloud contracts | COMPUTE › Orders · L2 | H100e · $ · date | F | — |
| Sites: stage, MW, ETA | COMPUTE › Sites · L2 | MW · date | F; ETA B·fc | — |
| Chip prices, vendor fill, export rules | COMPUTE › Market · L2 | $/H100e · % | F / B | — |

### LAB

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Compute allocation by use | LAB › allocation bar · L1 | % · H100e | F | TRAINING limits, Data, PRODUCTS, RESEARCH card "Gets" |
| Idle compute (per segment + total) | LAB › allocation bar · L1 | % · H100e | F | COMPUTE verdict `idle allocated ▸`, Alerts |
| Presets | LAB › allocation bar · L1 | — | F | — |
| Auto-split idle compute | LAB › policies · L2 | — | F | — |
| Safety work sub-uses (research, validations, cases, evals) | LAB › Safety work segment · L3 | % | F | SAFETY staffing chip |
| Safeguards compute (sum) | LAB › bar segment · L1 (read-only) | % | F | set via SAFETY › Safeguards |
| People, teams, quality per role | LAB › board People row · L1 | people · teams | F | — |
| Capability / safety scientist split | LAB › Scientists column · L1 | teams | F | RESEARCH board column heads (label-only chip) |
| Hiring target, offers, star hires, open positions, payroll | LAB › hiring drawer · L2 | people · $ | F | — |
| AI staff per job: model, copies | LAB › board AI staff row · L1 | copies | F | MODELS role chip |
| AI share per job | LAB › board AI staff row · L1 | % | M | Overview (link) |
| Total effort | LAB › board · L1 | × people alone | B | — |
| Needs per role (gets / needs, short, Spare, Idle), in order | LAB › board Needs · L1 | staff used · time to finish | F | TRAINING Run operations, MODELS Evals queue, SAFETY chip, RESEARCH idle teams |
| Build capacity, build queue, upkeep | LAB › Engineers needs · L1 / L2 | % in use · weeks of queue | F | PRODUCTS tools, RESEARCH lab tools |
| Run operations coverage | LAB › Research engineers needs · L1 | % covered | F | TRAINING limits |
| Safety RE order (Cases · Validations · Safety evals · Environment fixes · Foothold removal · Research experiments) | LAB › Safety band · L1 | staff used | F | SAFETY chip |
| AI share allowed, spot-checks (safety work) | LAB › AI staff detail · L2 | % · staff | F | — |
| Research taste of AI staff | LAB › Ideas AI-staff tooltip · L3 | vs your scientists | B | — |
| Cost per hour of AI work | LAB › AI staff detail · L2 | $/h | F | — |
| Best moves (compute and hires) | LAB › Best moves · L1 | % change of the target | B | RESEARCH Limited by, PRODUCTS Limited by |
| Safety spend | LAB › board Safety band footer · L2 | $/yr | F | — |

### RESEARCH

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Research speed + AI's part + trend | **L0 #6** (tooltip) | × leading lab Jul 2025 | B | RESEARCH header link |
| Limited by (lab-wide) | RESEARCH › Portfolio strip · L1 | word | B | Alerts |
| Priority order, cap / safety | RESEARCH › board · L1 | order | F | Discoveries node |
| Programme / project, output tag | RESEARCH › card · L1 | chip | F | — |
| Stage | RESEARCH › card · L1 | stage track | F | Discoveries node (state word only) |
| Next result ETA | RESEARCH › card · L1 | days | B·fc | — |
| Expected effect | RESEARCH › card · L1 | where it lands (% know-how area · named instrument / safeguard / method · unlock); range L3 | B | — |
| Chance it works (project) | RESEARCH › card · L1 | % | B | Discoveries node hover |
| Returns falling (programme) | RESEARCH › card · L1 | words ("each result ≈ ⅔ of the first") | B | — |
| Outlook (safety programme) | RESEARCH › card · L1 | Promising / Mixed / Struggling | B | — |
| Teams on it | RESEARCH › card · L1 | teams | F | — |
| Teams wanted, why this team | RESEARCH › card · L2 / L3 | teams · % | F / B | — |
| Gets: staff, experiment compute | RESEARCH › card · L2 | staff · % | F | links to LAB |
| Idea choice | RESEARCH › card · L2 | Safe / Balanced / Bold | F | — |
| Ideas under test, dropped; at scale | RESEARCH › card · L2 / L3 | expected effect · grows / holds / shrinks | B | — |
| Takes effect | RESEARCH › card · L2 | new base model / next post-training / a build / at once | F | — |
| Failed, retry | RESEARCH › card · L1 state | time lost (weeks) | F | Alerts |
| Expected vs observed results (safety) | RESEARCH › card · L2 | results / yr | B vs F | SAFETY Instruments warnings |
| Discovery node state, needs | RESEARCH › Discoveries · L1 | state word | F | — |
| Know-how per area: Public / Yours | RESEARCH › Know-how · L1 | × vs Jul 2025 | Public F; Yours B | — |
| Waiting | RESEARCH › Know-how · L1 | × | B | TRAINING prediction (`×2.2 waiting ▸`) |
| Idea list per area | RESEARCH › Know-how · L2 | +% each | B | — |
| Know-how growth | RESEARCH › Know-how · L2 | × per year | B | — |
| Measured effect (per model generation) | RESEARCH › Know-how · L2 | levels (Δ) | M | MODELS card |
| Domain effects | RESEARCH › Know-how · L2 | skill-bar change | B | — |
| Publish policy | RESEARCH › Know-how · L2 | — | F | — |
| Lab tools owned: effect, build, upkeep | RESEARCH › Know-how › Lab tools · L2 | AI share change · time to finish · staff used | F; effect B | LAB AI staff row |

### TRAINING

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Prediction: skill ghosts per domain, milestone | TRAINING › Next run · L1 | skill-bar ghosts (range) | B·fc | RESEARCH Waiting |
| Planned run's sight limit | TRAINING › Prediction tick · L1 | tick (levels short / past) | B | SAFETY header |
| Run plan options, two stages | TRAINING › Run plan · L1 | Skill · Time · Cost · Serving cost · Risk | F / B | — |
| Run duration, cost, run operations | TRAINING › Limits · L1 | days · $ · % covered | B·fc | — |
| Pushes per risk family; methods' predicted change | TRAINING › Next run · L2 | ↑ / ↓ pts | B | SAFETY › Model ("trained with") |
| Method's believed strength (tested up to …) | TRAINING › method option · L2 | range | B | SAFETY validation queue |
| Launch snapshot | TRAINING › Runs card · L2 | — | F | MODELS card |
| Runs: running / queued / continual learning, ETA, stall | TRAINING › Runs · L1 | days | F; ETA B·fc | Alerts, nav badge |
| Data by domain and source, re-reads, verdict | TRAINING › Data · L1 | T tokens · ×re-read | F | Limits strip |
| Data quality, mix | TRAINING › Data · L2 | % by domain | M | — |
| Generated data jobs | TRAINING › Data · L1 | tokens · H100e-days | F | — |
| Environments: Realism, Loopholes per family | TRAINING › Environments · L1 | % | M (Loopholes B) | — |
| Hacking pressure of the next run | TRAINING › Environments · L1 | low … high | B | Next run Risk column |

### MODELS

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Owned models, lineage, size, state, roles | MODELS › tree · L1 | B parameters | F | LAB, PRODUCTS, TRAINING run done |
| Skill per domain, range | MODELS › card · L1 | skill bar ± range | M | SAFETY "Able to" |
| Capability (overall) | MODELS › card · L1 | bar | M | — |
| Milestones met, date | MODELS › card · L1 | met / not met · date | M | Alerts |
| Benchmarks | MODELS › card · L2 | % · Maxed out | M | — |
| Jobs: skill at this job, can do alone, time horizon | MODELS › card · L2 | bar · % · hours | M | LAB AI share tooltip |
| Cost per hour of work | MODELS › card · L2 | $/h | F | PRODUCTS lineup |
| Trained with (methods, data, know-how) | MODELS › card · L2 | — | F | SAFETY › Model |
| Rivals' models (Q2) | MODELS › card tick · L3 | skill bar tick | M (released) | — |
| Eval queue, depth, Re-test when | MODELS › Evals · L1 / L2 | time to finish · days | F | LAB RE needs |

### PRODUCTS (provisional)

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Revenue per product, Limited by | PRODUCTS › revenue · L1 | $/yr · word | F / B | Finance |
| Lineup: models, share of hours | PRODUCTS › card · L1 | % of hours | F | MODELS role chip |
| Tools on the product | PRODUCTS › card · L1 | where it helps · cost per task | F / B | — |
| Sector certification | PRODUCTS › card · L1 | date · effect | F | — |
| Price, thinking effort | PRODUCTS › card · L1 | Low / Standard / Premium · cost × | F | — |
| Served / unserved | PRODUCTS › served bar · L1 | % | F | LAB Products segment |
| Customers, market share target | PRODUCTS › card · L2 | count · % · weeks to win | F / B | — |
| Hours of work sold, seats | PRODUCTS › card · L2 | hours · $ | F | — |
| Rival best price | PRODUCTS › card · L2 | $/h | B·intel | — |
| Serve order; auto-make smaller sizes; usage policy | PRODUCTS › policies · L2 | — | F | TRAINING Runs ("auto") |

### SAFETY (provisional)

| Datum | Home | Unit | Basis | Linked from |
|---|---|---|---|---|
| Loss-of-control risk, lab (max over running models, model named) | **L0 #7** | % (range) / Unknown | B | — |
| Loss-of-control risk, selected model (gauge) | SAFETY › header · L1 | % (range) | B | — |
| Unstopped harm / yr | SAFETY › header · L1 | /yr by severity | B | Incident cards |
| Sight limit vs selected model | SAFETY › header · L1 | levels short / past | B | TRAINING planned tick |
| Framework hold | SAFETY › header · L1 | rule → Hold | F | Alerts, MODELS release |
| Act rows: Would try · Able to · Chances · Stop rate · Unstopped | SAFETY › Risks · L1 | % · bar · /yr · % · /yr | B · M · F · B · B | Incident cards |
| Footholds | SAFETY › Risks foot · L1 (once suspected) / L2 card | points of risk | B | — |
| Beliefs per family / trait, Unknown | SAFETY › Model · L1 / L2 | % (low–high) | B | MODELS card |
| Evidence per trait | SAFETY › Model · L2 | list | M | — |
| In tests vs in real use | SAFETY › Model · L2 | % (range) | M | — |
| Instrument reliability, validated on, reasons | SAFETY › Instruments · L1 | % (range) · validated on … | M / B | RESEARCH safety card result |
| Disagreement chips | SAFETY › Instruments · L1 | chip | M | — |
| Detection grid, sight-limit history | SAFETY › Instruments · L2 | % · levels | B | — |
| Validation queue (instruments and methods) | SAFETY › Instruments · L2 | k of n · time to finish | F | TRAINING method, LAB |
| Safeguards per deployment: stop rate, Slowdown, compute, staff | SAFETY › Safeguards · L1 | % · % · H100e · staff | B / F | LAB AI staff, PRODUCTS card |
| Watcher model, watched share, watcher gap | SAFETY › Safeguards · L2 | name · % · levels | F / M | — |
| Framework safeguards (auto-applied) | SAFETY › Safeguards marks · L1 | — | F | — |
| Incidents | SAFETY › Incidents & cases · L1 | severity word · deadline | F; cause B | Alerts |
| Cases | SAFETY › Incidents & cases · L1 | time to finish · verdict | F | — |
| Framework rules, disclosure policy | SAFETY › L2 editors | — | F | — |

### Duplicates the audit found → one home

| Audit finding | Resolution |
|---|---|
| Allocation set in 4 places (Split, Blueprint pool share, Data pool share, Products serving) | **LAB bar only.** The other three become link chips plus read-only previews ("at 60%: 70 d") |
| AI share: Overview 63% vs Company 0.0% | One definition (share of the job's work done by AI staff), **LAB board**. Overview links to it |
| Three risk readouts (27% catastrophe, 0.0% loss of control, "past sight limit") | L0 loss-of-control (lab max) + SAFETY header (selected model) from one computation; catastrophe gauge deleted; **Unknown** state instead of 0% |
| Sight limit in 6 places | **SAFETY header** (current) and TRAINING (planned run, a different datum). Race chart and trait grid → SAFETY › Instruments L2 |
| Capability: 6.8 top strip vs 7.0 "best" vs 9.1 predicted | No capability number in L0. Every capability readout names its model; home is the **MODELS card** |
| Idle: "0.0%" vs "46% idle now" | Idle hatched **inside each segment** plus one total, in the LAB bar |
| Know-how: "Not trained in" > total | **Waiting is a part of Yours** (stacked), by construction ≤ total; both beliefs |
| Monitor internal agents + Trusted to AI (Company and Safety) | Monitor → **SAFETY › Safeguards** (internal deployment, OQ-7); AI share allowed / spot-checks → **LAB** |
| Research speed (crashing Flow tab only) | **L0 #6** |
| Safety research split from capability (Research lines vs Projects) | **One RESEARCH board**, one card grammar |
| Runs in progress (Models) vs bottom-bar launch | **TRAINING › Runs** only |
| Data, environments under MODELS | **TRAINING** (they are the run's ingredients) |
| Next-hire buys and compute levers in separate places | **LAB Best moves** (Q6) |
| SAFETY capacity strip copying LAB numbers | One verdict chip → LAB |
| How close AI is to each job (Work tab) vs model card | **MODELS card** (a model property); LAB shows the resulting AI share |
| KYC on Products and on Security | A **restriction safeguard** in SAFETY › Safeguards |

### Audit §4 conflicts with the old draft → resolved

| # | Conflict | Now |
|---|---|---|
| 1 | Assumed homes that crash | Homes are designed fresh; research speed → L0 |
| 2 | "Packages" for AI staff | AI staff **by job** (Engineering · Experiments · Ideas · Safety); "package" is gone |
| 3 | Internal tooling in LAB | RESEARCH › Know-how › Lab tools |
| 4 | OOM in tooltips; team-weeks | No OOM in player view; time to finish + staff used; team-weeks only in breakdown tooltips |
| 5 | Loss of control as hero | Small L0 item; gauge on SAFETY only (decided) |
| 6 | "Sight L 9.1" in L0 | Removed; sight limit is a tick on the capability ruler (SAFETY, TRAINING) |
| 7 | Trait graph deleted, its explanation lost | The detection grid moves to the sight-limit drill-down; the evidence map moves to the Codex |
| 8 | Know-how "Fact" | Belief until measured |
| 9 | Allocation controls elsewhere | Become links (table above) |
| 10 | Name drift | VOCAB words throughout (Next run, Post-training ceiling, Discoveries, Know-how) |

### Truth guard

The UI never reads:
- true traits, true reliability or the true sight limit;
- true lead or true know-how stacks;
- hidden world draws or method at-scale efficacy;
- unfound footholds or sabotage flags.

Leaks to fix before mockups are built live:
- "Waiting" / know-how growth reading the true stacks (B9);
- the teacher table's G column;
- the measured-domain fallback (MEDIA / PHYS true offset).

---

## 3. Cross-tab links (chip jumps to the home; it shows no copied number)

| From | Chip | To |
|---|---|---|
| L0 Research speed | click | RESEARCH › Portfolio strip |
| L0 Loss-of-control risk | click | SAFETY › Risks (picker = the named model) |
| RESEARCH Limited by | `compute ▸` / `research engineers ▸` | LAB › Best moves, that move |
| RESEARCH card Gets | `experiment compute ▸` | LAB › bar, Research experiments |
| RESEARCH column heads | `scientists ▸` | LAB › Scientists split |
| RESEARCH idle teams | `3 teams idle ▸` | LAB › Scientists column |
| RESEARCH safety result | `new instrument ▸` | SAFETY › Instruments |
| RESEARCH Know-how Waiting | `next run ▸` | TRAINING › Next run |
| RESEARCH Lab tools | `build queue ▸` | LAB › Engineers needs |
| TRAINING Limits: Compute / Run operations | `training share ▸` / `run operations ▸` | LAB |
| TRAINING Data | `data generation share ▸` | LAB › bar |
| TRAINING planned sight limit | `instruments ▸` | SAFETY › Instruments |
| TRAINING run done | `Atlas-4 ▸` | MODELS › card |
| MODELS role chip | `AI staff: experiments ▸` / `in Chat lineup ▸` | LAB board / PRODUCTS card |
| MODELS card | `beliefs ▸` / `risks ▸` | SAFETY › Model / Risks (picker set) |
| MODELS Evals | `research engineers ▸` | LAB › RE needs |
| PRODUCTS served bar | `serving share ▸` | LAB › bar, Products |
| PRODUCTS card | `safeguards ▸` | SAFETY › Safeguards (that deployment) |
| SAFETY act row Able to | `skill ▸` | MODELS › card |
| SAFETY staffing | `Safety staff: short ▸` | LAB › Safety band |
| SAFETY incident | `act row ▸` | SAFETY › Risks |
| LAB AI staff row | `model ▸` / `safeguards ▸` / `lab tools ▸` | MODELS / SAFETY › Safeguards / RESEARCH |
| LAB bar total | `compute online ▸` | COMPUTE › forecast |
| COMPUTE verdict | `idle allocated compute ▸` | LAB bar (distinct from Unracked) |

---

## 4. Deleted from player view

| What | Where it goes |
|---|---|
| Symbols G, L, U, M, X, c, ℓ, λ, ω, κ, S1–S9, "SD", sci notation, formulas | Designer overlay |
| OOM (all ~150 uses), FLOP/day, FLOP/tok, "e24" | VOCAB §1 units; overlay |
| team-eq, t-wk, team-mo, tm, "−12 staff" | Time to finish + staff used; team-weeks in breakdown tooltips |
| Doc refs in tooltips ("MODEL-V3 §5", "research/20 C1", "[D]", "stand-in"; ≈ 400 footers) | Designer overlay |
| Paper citations in tooltips | Codex "Based on" line only (DQ-2) |
| Code ids (P11, AG07, V7, post 21, SCHEME, evalGov, CODE / RSCH) | Display names |
| Raw enums, layer badges B/T/S/L, Effort S–XL, D/C/O | VOCAB words |
| Pool, Line, Recipe, Blueprint, Tree, Suites, Split, package, headroom, Health, "Routine / Frontier research" | VOCAB words (§5 collisions) |
| Catastrophe risk gauge (top strip), Control card / gauge, race chart as a tab, Trait graph tab, Policies tab, Research lines tab | §2 homes; evidence map to Codex |
| "What more of each buys" flat curves, "Binds" on every row, Teams-wanted dots, radar without scale | Best moves; per-card limit only when different; skill bars |
| Stale systems: pledge, "U", sector add-ons, KYC picker, package selector, tool upkeep | Removed / replaced per DECISIONS |
| Allocation controls outside LAB | Link chips |
| Engine diagnostics (elasticities, prod fn, realised effects) | Designer overlay |

---

## 5. Open questions for the designer

| # | Question | Recommendation (first principles) |
|---|---|---|
| Q1 | Revenue in the top bar? It is the 8th item | **Drop it from L0**; put revenue and burn in the Cash · runway tooltip. Runway is what decides whether you can act; revenue is one of its causes and has a home in Finance |
| Q2 | How do rivals' models appear on MODELS? | **Released rival models, measured by your own evals**, as ticks on the skill bars (M). Unreleased models appear only through Lead (B·intel). A lab can benchmark a public API but not see an internal model, and a measured ruler should not carry intel guesses |
| Q3 | Show rivals' know-how on Know-how ([30] proposed a rival estimate)? | **No.** Rivals are aggregates (DD-18) with no per-area recipe, and a lab can't observe a rival's recipe, only its models. Public know-how is observable and stays; "are we ahead" is the Lead item's job |
| Q4 | Overview screen (core loop, lead lanes, race chart, AI-share line): it sits outside the 7 tabs and duplicates R&D data | **A hub**: the core-loop diagram, each node a link chip with one verdict word; the lead lanes (home of the lead detail). Delete the race chart (now SAFETY drill-down) and the AI-share line (LAB) |
| Q5 | Progressive disclosure: show empty panels from day 0, or reveal when relevant? | **Reveal on first relevance**: the AI staff row once AI share > 0, the footholds line once one is suspected, the Environments family once unlocked. Add a one-time coach mark; the nav stays stable. Day 0 then shows fewer, truer things (the audit's day-0 "no project ready" next to six ready projects) |
| Q6 | [30] put "Next hire buys" under each LAB column and compute levers separately. Merge them into one ranked **Best moves** list? | **Merge.** The player's question is "what should I add?", not "what does a hire in column X buy?". One ranking across compute and people shows the true bottleneck and lets RESEARCH, TRAINING and PRODUCTS "Limited by" chips all point to one place |

---

## 6. Mockups: order (biggest clarity wins first)

| # | Screen | Why first |
|---|---|---|
| 1 | **L0 shell + LAB** (allocation bar, workforce board, Best moves) | Crashes today; allocation set in 4 places; AI-share contradiction; research speed unreachable. The shell appears on every later mockup |
| 2 | **RESEARCH › Portfolio** | The designer's core confusion: capability and safety as two games, OOM payoffs, no chain to the outcome |
| 3 | **TRAINING › Next run** | A ~260-line Blueprint → prediction ghost bars, two-stage plan, limits strip |
| 4 | RESEARCH › Know-how | OOM → ×; the Waiting contradiction; the truth leak |
| 5 | SAFETY header + Risks | Already sketched in SAFETY-REDESIGN §7; draw it once the SR engine rows land |
| 6 | MODELS card + tree | Skill bars and milestone ladder (OQ-6) |
| later | PRODUCTS (after Phase 7), COMPUTE (only loses Split), Discoveries, Data, Environments, Runs | Smaller changes or engine-dependent |

Use real numbers from the `day400.json` fixture (RefBot) and a day-0 game; mock each screen at both stages.
