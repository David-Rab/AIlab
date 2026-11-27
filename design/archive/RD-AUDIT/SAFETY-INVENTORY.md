# Safety from the player's side: inventory and diagnosis

Read-only audit of the safety side of AI27 as the player meets it. It covers every verb, readout, policy and passive
mechanism the player can see (or that changes what they see), with the engine behind each one. Hidden truth is
deliberate and is not counted as a problem. The problems counted are cases where the player cannot tell what an
action does, what a number means, or where a resource goes.

Conventions
- Engine paths are relative to `src/engine/v2/`, UI paths to `src/ui/v2/panels/` (shell files to `src/ui/v2/shell/`),
  data to `src/data/v2/`. A line number points to the function or row.
- `SAF-xx` / `SAF-Vxx` refer to the earlier audit `research-safety.md` and `research-safety.verified.md`. Those items
  are not re-argued here, only cited.
- Kind: **A** action (a button the player presses), **P** policy (a standing setting), **R** readout,
  **M** passive mechanism (runs on its own; the player sees only its effects).
- Inputs: SSci = safety science teams, SRE = safety research engineers, CRE = capability research engineers,
  SPool = safety compute pool (`split.safety`), Serve = serving compute, $ = cash, G = progress (effective-compute
  penalty on the next run), t = time.

---

## Part 1. Inventory (128 items)

### R. Research lines, projects, results (11)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| R1 | "Research lines" table (18 lines; staffed first, "Show all 18") | R | Safety › Research lines | Safety programmes I can staff | `safety/view.ts:42` lineRows | SSci | Feeds tools (T*), results (R5), U | Two engines and two allocators for research (SAF-02, SAF-03). "Line" in the UI, "Agenda" in Codex and the glossary (SAF-09). 16 of the 18 rows are hidden by default. |
| R2 | Health pill Promising / Mixed / Struggling with a 90% band | R | line row | "Estimated chance a project here gives a working tool" | `safety/agendas.ts:135` posteriorBand (Beta) | — | The same hidden `e` scales every tool of the line, AG18 healing and targeted training | It is not a posterior of the draw (SAF-15). It also weakens tools already in use, which the tooltip does not say (SAF-16). |
| R3 | "+" add team / "Take off" | A | line row, team chip | Put a team on a line to get results | `research.assign/unassign`; `safety/agendas.ts:80` lineStaffed | SSci | **Staffing switches on**: fix methods in every post-run, AG07 monitoring effects, AG18 healing, the AG17 harness (SAF-04) | The biggest hidden effect of any safety verb. Taking a team off a line silently removes training methods from every run. Nothing on the row says so. |
| R4 | Project name, progress bar, ETA ("next result") | R | line row | When my next result arrives | `models/tree.ts` projectEta; `safety/lineProjects.ts:314` | SSci, SRE, SPool | — | The ETA is to "a result", not to the node (SAF-08). It leaves out sandbagging (SAF-26). The copy "research speed" is stale (SAF-21). "Follow-up" is a hidden node (SAF-09). A node whose row cannot fire never completes (SAF-V02). |
| R5 | Results feed: Tool / Eval / Discovery / Dead end / Negative / Spillover; "retracted" strikethrough | R | Research lines › Results | What my research found | `safety/view.ts:160` findingRows; `safety/findings.ts:224` | — | A TECH result unlocks a tool; DISC finds a U-mode; NEG lowers a tool's half-strength point (glossary halfStrength) | A result row does not say what it changed: which tool, which U-mode, which tool lost about 1 OOM. FALSE results show as "Tool" (deliberate). |
| R6 | "Publish" button per result | A | Results card | Share a finding | `safety/actions.ts:327` | lead days | credibility +2, talent +1, "rivals' alignment +0.02"; approval risk | The preview is in abstract currencies. "Alignment 0.02 (shared pool)" means nothing to the player. Overlaps the publish policy (O1), which auto-publishes on "all". |
| R7 | "Dead ends · n team-mo lost" badge and column | R | Lines tab badge, row | Wasted effort | `safety/findings.ts:313` | — | Puts the line at ×0.5 speed permanently | A one-way latch (SAF-14). The glossary implies the slowdown ends. |
| R8 | "n idle" badge / "Promising, no team" section | R | Lines tab | Lines worth staffing | `safety/agendas.ts:143` promisingIdle | — | — | Fine as a pointer. It is the only nudge, and it pushes toward staffing (and so toward R3's hidden switches). |
| R9 | Line tooltip: ideas known, first result at serious staffing, staffing % of serious, compute share, work AI does | R | line name hover | How fast this line goes | `safety/view.ts:52-60` | — | — | The effort class is wrong (SAF-13). The copy still says "√ capacity" (SAF-21). Compute share is in internal units (SAF-24). "Serious staffing" is a v2 unit. |
| R10 | Safety nodes on the Research tree (filter "Safety") | A | Research › tree | Queue safety ideas | `models/tree.ts:120-129, 366-486` | SSci | the same nodes as R1 | Two screens staff the same thing. P27 and kyc use the old rolled path (SAF-18). Line nodes complete through other nodes' results (SAF-08). |
| R11 | Auto-assign (safety) | P | Research / glossary | Idle teams get work | `models/tree.ts:366-440` | SSci | turns on R3's switches | Quietly staffs lines that were never queued (SAF-23). |

### T. Tools and methods (12)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| T1 | "Tools n · strength on today's model" (collapsed, "Show") | R | Research lines › Tools | My safety stack | `safety/view.ts:132` techniqueRows | — | U, cases, monitors, containment, training removal | Collapsed by default, so the stack the whole safety game rests on is two clicks deep. Detect, contain and fix tools share one list. |
| T2 | Tool **On / Off** | A | Tools card | Switch a tool | `safety/actions.ts:407` | none in practice | Off removes the tool from detection, containment and edge effects | The preview claims "0.5% of serving for monitors" as the cost of On. Nothing charges it: no reader of `active` costs compute. So Off never pays, and the verb has no reason to exist. Off tools still take upkeep engineers (SAF-V01). |
| T3 | "fix" tag vs On/Off (role) | R | Tools card | Detector or training method | `safety/techniques.ts:70` techniqueRole | — | — | The role labels mislead. Several **detect/contain** tools also change training edges: T-HONEY E10 ×0.7, T-NOISE E18 ×0.6, T-LOCK E21 ×0.5, T-TMON E14/E22 ×0.5 (`safety/traits.ts:662-672`). So switching a "detector" off changes how models train. |
| T4 | Strength, "Faded x%", "Half strength at L x" | R | tool tooltip | How well the tool still works | `safety/techniques.ts:22-51` | — | U, cases, monitors | There are many meanings of strength (SAF-19). A fix tool's strength drives nothing (SAF-07). "Faded" is 1 − decay, but `decay` in code is the remaining share. Half-points are v2 M½ units converted (SAF-12). |
| T5 | Tool upkeep card: engineer bar (cases / patches / experiments / upkeep), "n tools fading · d per OOM of headroom" or "crew too thin (x per tool, needs 15+)" | R | Research lines (side) | Engineers keep tools working | `safety/agendas.ts:162-193`; `safety/view.ts:106` | SRE | oHalf (truth) and the validation lead (believed U only) | No control (SAF-03). Fix methods count as fading tools (SAF-V01). One pool is counted twice (SAF-10). The 15 and 40 are invented (SAF-11). **Foothold-removal engineers show as "patches"** (`safety/responses.ts:72-74` patchFte adds removalFte). |
| T6 | "Tools validated to L x" | R | U tooltip, race tooltip | How far tools were re-checked | `safety/view.ts:113-119` (median oHalf of active detect tools) | — | — | A third "how far can I see" number beside U and "seen to" (U1, U5). The race tooltip explains it as "U can sit lower". |
| T7 | "Next to fade: X (y% faded)" | R | Trait graph tab | Which tool goes next | `safety/understanding.ts:301` | — | — | Shown only on the Trait graph tab, far from the upkeep card that acts on it. |
| T8 | "masked" tag, Goodhart G | R | Tools card, race tooltip, Codex | A tool I trained against reads less | `safety/techniques.ts:22-25`; `safety/traits.ts:805` goodhartTrain | — | — | The only way to create a mask is the Retrain-against response (I5). The run-level train-against list is dead wiring (SAF-05). |
| T9 | A tool that turns out false ("retracted"); "corrupted safety tool" foothold | M | Results, Footholds | A tool I relied on was fake | `safety/findings.ts:373-388`; `safety/footholds.ts:203` | — | Masks instead of detecting | One thing has two names (a false finding, a corrupted-tool foothold) in two tabs. Cross-checks happen only as a side effect (an AG02/AG08 NEG result, a case with another family). There is no verb to verify a tool. |
| T10 | Fix methods (T-PERSONA, T-CAST, T-W2S, T-CONFESS, T-ANTISCHEME) "used in every post-training run while its line is staffed" | M | Tools card tooltip | Training methods I own | `safety/traits.ts:628-633` inRun, `:635-683` playerMods | SSci (staffing) | Trait edges in every post-run | Live while staffed (SAF-04). Effects are flat and ignore strength (SAF-07). T-SPEC, T-HARDEN and T-UNDO do nothing (SAF-06). **T-INOC and T-FILTER only unlock Blueprint options** (`data/v2/tree.ts:203-204`) yet are listed as methods "used in every run". Overlaps P1/P2/P4 and I6. |
| T11 | Containment (AG07 tools) | M | inside Control, Danger, catch rate | — | `safety/techniques.ts:100-109` containment | — | block in danger and control; +½ on catch rate | It has no home: it shows up as "blocked by containment", "blocked", "+ AI-control tools", and needs the control layer. The player cannot see a containment number. |
| T12 | Codex agenda card (tool family, coverage, compute share, Goodhart G, half strength) | R | Codex | Reference | `src/ui/v2/panels/Codex.tsx:41` | — | — | The compute share is a stale % of lab compute (SAF-21). Special cases per agenda are not listed (SAF-22). |

### U. Understanding and detection (11)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| U1 | Race meter: CAPABILITY L · "x AHEAD / BLIND" · UNDERSTANDING U (dashed likely range) | R | Top strip (hero) | Am I ahead of my model? | `shell/TopStrip.tsx:85`; `safety/understanding.ts:133` | — | E17 red flag at margin < −1; catastrophe risk (30% weight) | U is "the largest L where mean believed detection of 6 critical traits ≥ 50%". That is a fact about **tools**, not about the model. Believed U reads posterior means, so **cutting safety research does not lower it** (`safety/understanding.ts:156-166` comment: S5R, half the safety compute moved believed U +0.29 while true U fell 0.64). |
| U2 | Race tooltip: validated to, likely range, detection per critical trait, why U moved, fading / masked tools, levers | R | Top strip hover | Why | `shell/TopStrip.tsx:22-79` | — | — | Good content, but it is the third copy of the same data (with the verdict tip U3 and UTip U5). |
| U3 | Verdict banner: "Understanding ahead, but n of 4 risk families unseen" · "x levels ahead · holding · tools fall behind in ~m mo" + cause chains | R | Safety › Overview | Overall safety state | `Safety.tsx:141-183` | — | — | **Two meanings of "unseen" in one banner.** The title counts families with mean *clarity* < 0.3 (`safety/view.ts:96`). The chain "Deception unseen" uses *seenTo < L* (detection, `Safety.tsx:153`). The "Research" button goes to the Research panel, not to the line. |
| U4 | Capability vs understanding chart (6 months back, 4 ahead, blind hatch, dashed projections, "U, if <idea>") | R | Safety › Overview | The race over time | `Safety.tsx:195-278` | — | — | The projected U grows at min(capability, tool-upkeep rate). The upkeep rate is the "validated to" rate, not a U rate. "U, if idea" assumes the idea works at believed efficacy and is drawn only if the ETA is ≤ 17 weeks. |
| U5 | U tooltip: each family "seen to L", tools validated to, upkeep vs capability per month | R | chart point | — | `Safety.tsx:281-292`; `safety/understanding.ts:275` familySeenTo | — | — | "Seen to" is a fourth level-type readout (U, validated to, seen to, measured L). |
| U6 | "Can your tools see it?" grid (trait × level heatmap, 50% line) | R | Trait graph tab | Where my tools stop seeing | `Safety.tsx:739-770`; detectionGrid | — | — | A good picture, but on the Trait graph tab, not next to U. |
| U7 | "Likely range" of U | R | Top strip band, race tooltip | How sure U is | `safety/understanding.ts:206` | — | display only | Fine. It is the only honest uncertainty on U and is drawn as a faint dashed box. |
| U8 | Validation lead | M | invisible | — | `safety/understanding.ts:35-45` | SRE | believed U only | SAF-10. |
| U9 | **Blind gap makes models worse** (trait growth × (1 + 0.4 per level of true gap, ≤ 2.5)) | M | glossary `gap` only | — | `safety/traits.ts:690-700` understandingGapGrowth | — | every run's trait growth | The race bar and chart treat "blind" as visibility. Only the glossary entry for `gap` says "hidden traits grow faster". The growth uses the **true** gap, so believed U can say "ahead" while models drift. |
| U10 | Watch item "n critical traits unseen" | R | Overview watch list | Problem to fix | `shell/watch.ts:52-63` | — | — | A **third** definition of unseen: per-trait detection < 50% at today's level. |
| U11 | Detection decides how much safety training removes ("what you can see you can fix") | M | invisible | — | `safety/detection.ts:293` stackDetectionMap → `safety/traits.ts:723` | — | the removal in every post-run | Detect tools are also fix inputs. The Blueprint prediction leaves this out (P6). The player never learns that a stronger stack makes training work better. |

### B. Beliefs, traits, families, misalignment (11)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| B1 | Trait belief "0.23 ± 0.08" (19 traits; Kind: behaviour / awareness / disposition / protective) | R | family rows, trait graph pills, evidence card | What I think the model is like | `safety/detection.ts:23` updateBelief | — | everything below | Numbers are 0–1 "rates" with no unit sentence (rate of what?). Protective traits read the other way round. |
| B2 | Clarity % | R | trait tooltip, families | How sure the belief is | `safety/detection.ts:23-28` (1 − sd/0.35), drift `:333` | — | "unseen" (B3), red flags (B11) | Several meanings (SAF-20). It decays with no visible clock. |
| B3 | Risk families card: 4 families, estimate ± band, eye / blind / magnifier icons, version tabs | R | Overview side (tab vs Successor pull) | Which kind of misalignment | `safety/view.ts:83` riskFamilies | — | — | The family estimate is the **max** trait. Misalignment (B7) is a **weighted sum**. Colours: red ≥ 0.3, amber ≥ 0.15 here (`Safety.tsx:296`); "watch" ≥ 0.3 on Agents badges; 0.05/0.2/0.4/0.7 on the trait graph legend; 0.2/0.4 on the misalignment card. That is four colour scales for one belief. Shares the side column with Successor pull, so one of them is always hidden. |
| B4 | "Outside the families" (SA, HONEST, CORRIG…) | R | Families card | — | `Safety.tsx:298` | — | HONEST and CORRIG enter misalignment | They enter the misalignment index but sit in a collapsed "other" row. |
| B5 | Trait graph (signals → learned → awareness → hidden → tools see; edges w̄, grades A–D, upstream lighting) | R | Safety › Trait graph | How training shapes dispositions | `safety/view.ts:191` traitGraph; `TraitGraph.tsx` | — | — | Heavy concept load (edge, weight, grade, moderator, layer). The player cannot act on an edge here. Patch signal (I4) lives only in the incident menu. |
| B6 | Evidence card: belief, "Your tools catch it x%", incoming edges with citations; buttons Investigate · 15 engineers / Less <signal> / Tool upkeep / Research lines | R+A | trait graph hover | Why this trait, what to do | `TraitGraph.tsx:210-258` | — | — | "Catch" here means detection, not a monitor's catch rate (M3). "Less <signal>" opens the Blueprint without saying which slot. |
| B7 | Estimated misalignment: estimate, 90% band, "danger line 0.40 (published)" | R | Trait graph side | Is the model past the line | `safety/traits.ts:526-540`; `Safety.tsx:773-795` | — | catastrophe risk (70% weight), control | The same 0.40 is: the misalignment "danger line" here, the centre of the catastrophe-risk curve (`actors/intel.ts:96-97`), and the hidden loss line on **exposure** (`safety/control.ts:41`). So 0.4 is one threshold applied to two different quantities. |
| B8 | "Failure modes found" cards (name, shows as <trait>, public) | R | Trait graph side | Unknown problems found | `safety/view.ts:184`; `safety/umodes.ts:104` | — | Incidents stop reading "unexplained"; Disclose reveals them | There is no verb to look for them (they come from DISC results and cases). The card does not say what finding one changed. |
| B9 | Belief drift (sd grows; stream versions +0.05/day) | M | invisible | — | `safety/detection.ts:333` | — | clarity, unseen | Not shown. It is the reason a family flips to "unseen" with no event. |
| B10 | Which model? (version tabs, "beliefs for" picker, case "in V") | R | Families, graph, cases | — | `store.sel.versionId` | — | — | Each readout uses a different model. Chart and U: the internal model. Families, graph and cases: the selected one. Control: the lowest of the best model and internal fleets (`safety/control.ts:206`). Catastrophe risk: the internal model. Danger: each deployment's model. |
| B11 | Red flags (SCHEME/AF/SAND est > 0.3 at clarity > 0.4) | M | event E17 only | — | `safety/common.ts:37-46` | — | E17, whistleblower worth (`security/security.ts:45`) | No readout shows a flag building. Its threshold differs from the families' "watch" (≥ 0.3 with no clarity condition). |

### E. Evaluations (6)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| E1 | "Evaluate before release" toggle + "external"; "+d days per release" | P | Safety › Policies (also Models › Evals) | New models wait for evals before use | `safety/actions.ts:389`; `models/evals.ts:175` releaseEvals; `models/deployments.ts:48-60` | **CRE** (not SRE), compute | belief updates through the suite; T-PROP edge | The tooltip says "before it can be used or sold", but the gate blocks **external products only** (`deployments.ts:51`: internal → allowed). The preview's "alignment d/60 pre-deployment clarity" and "+1/+3 credibility" are never applied (apply only sets the gate). Hidden coupling: gate on + T-PROP → E01 ×0.7 in training (`safety/traits.ts:639`). The engine has 4 levels; the Safety toggle offers 3. |
| E2 | Behavioural safety evals (propensity rates) | M | **not shown anywhere** | — | `safety/detection.ts:221` safetyEvalSuite; `models/benchmarks.ts:92` | — | beliefs | `v.evals.safety` rates are written by two writers and read by no UI. The player sees only belief shifts, never "propensity eval: 12% scheming, ± …". The eval-awareness confound is invisible. |
| E3 | Eval queue, depth, order, measurement band | A/R | Models › Evals | Measure capability | `models/evals.ts` | CRE, compute | beliefs (safety part of the suite) | Framed only as capability measurement. The safety value of a deeper suite is not shown. |
| E4 | External evaluators (independent / government) | A/P | Evals, gate "external" | Outside check | `safety/detection.ts:243` observeExternal | trust, compute | evalIndep: BB detection ≥ 0.35; evalGov: misuse only | What each evaluator adds to beliefs is not stated anywhere. |
| E5 | Auto-evaluate / re-run rule | P | Models › Evals | Keep models measured | `models/evals.ts:196` reevalReason | CRE | fresh beliefs | Its safety role (fighting B9 drift) is not mentioned. |
| E6 | Release clearance | M | glossary | — | `models/deployments.ts:48` deployGate | — | — | The glossary says "passes the evaluation policy (auto-evaluate)". The gate is the eval gate, not auto-evaluate. |

### M. Monitoring and the control layer (11)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| M1 | "Monitor internal agents: n of 4 uses · x% watched · y% of safety compute" with ± budget | P | Safety › Policies | Spend safety compute on monitors | `departments/agentActions.ts:309`; `departments/agents.ts:113-160` | SPool (taken **first**) | coverage → strength → catch, runtime observations, foothold suspicion | Raising it takes compute from research-line experiments (`safety/agendas.ts:92-108`). The tooltip shows H100e spent, not what the lines lose. |
| M2 | Monitor model per lane (none / copy of model / another model) | A | Company › Agents at work | Choose who watches | `departments/agentActions.ts:228`; `departments/agents.ts:142` | SPool | M1 coverage via cost ratio | The home is split: budget on Safety, model on Company. |
| M3 | Catch % chip with gap, coverage, "same model" tag | R | Agents lane, Products card | How much the monitor catches | `models/products.ts:104` catchRate; `departments/agents.ts:142` | — | — | **The number shown is not the one used.** Internal incidents are caught with detection tools × (½ + ½ × monitor strength) (`safety/detection.ts:323`). The chip shows the monitor model's catch rate. Its own note says so in small print. |
| M4 | "same model" tag (collusion) | R | Agents lane | A self-monitor can collude | `models/products.ts:113-116` | — | ×0.6 catch on scheming-type (×0.8 with T-LOCK) | The **default package is the collusion case**: routine and frontier research start with a "copy" monitor (`departments/agents.ts:28-29`). |
| M5 | Runtime monitoring | M | glossary | Weekly observations | `safety/detection.ts:255` | — | beliefs, foothold suspicion (`safety/footholdDetection.ts:74`) | Monitors have three jobs (catch, observe, surface footholds). The UI shows one (catch). |
| M6 | Product monitor (pick, catch, "+x% of serving") | A | Products card | Catch incidents before customers | `models/products.ts:104`; `safety/incidents.ts:216` | Serve | product incident catch | A different formula (gap + ½ containment, no detection tools) and a different budget (serving) from internal monitors. Two glossary terms (`monitor`, `agentMonitor`). |
| M7 | Control layer on/off: "Add control" / "Remove control" | A | Control card, incident menu, E17 "Continue + control" | Trusted monitoring with deferral | `safety/responses.ts:179-190`; `safety/oversight.ts:161-177` | AI labour (tax) | containment blocks, deferral miss ×; control, danger | Three entry points. It applies to **every** deployment of the version, products included. The Control card adds it to the lowest-control model, but the tax shown is the "largest lane's". RESPONSE_INFO's note "5% usefulness tax; catastrophe conversion × (1 − Contain)" is stale. |
| M8 | Control tax "−x% AI labour" | R | Control card, lanes | Cost of control | `safety/oversight.ts:161` | — | — | Fine. |
| M9 | Human review / "gap above expert humans" | R/M | Control oversight tooltip | — | `safety/oversight.ts:121` | human share of work | oversight | No verb, only "less AI R&D", and that is not a direct setting either. |
| M10 | Successor "unwatched %" / "R&D oversight" | R | Successor pull card | — | `safety/pressureView.ts:244` | — | — | A third oversight number (see F2, D1). |
| M11 | Comms lockdown (T-LOCK) | M | Agents collusion tooltip | — | `models/products.ts:115`; `safety/traits.ts:671` | — | collusion penalty halved, E21 ×0.5 | A detect/contain tool with a training effect (T3). |

### C. Investigations (6)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| C1 | "Open a case on <trait> in <V> with <n> safety research engineers · Investigate" | A | Safety › Cases | Look hard at one trait | `safety/actions.ts:65`; `safety/investigations.ts:78` | SRE 5–40, SPool 5% | beliefs, U-modes, footholds, false-tool exposure | The engine supports choosing tools and the compute share; the UI offers neither, so the 5% default is invisible. The preview is good (clarity/month, corruption odds). |
| C2 | Investigate buttons elsewhere | A | incident card, evidence card "· 15 engineers", foothold row, Risk lever "Investigate scheming", E17 "Pause & investigate" (20) | — | same | SRE 15 fixed | — | Six entry points, five of them at a fixed size. |
| C3 | Case clarity bar (resolves at 80%, max 120 d) | R | case card | Progress | `safety/investigations.ts:128, 148-173` | — | — | "Clarity" again, a different stock (SAF-20). Invented rate (SAF-25). |
| C4 | Close case | A | case card | Stop early | `safety/actions.ts:120` | — | frees SRE | The preview's cost reads "alignment: clarity not reached", an internal unit. |
| C5 | Outcome label: confirmed ≈ x / benign / inconclusive / false alarm / discovery | R | closed case | Verdict | `safety/investigations.ts:189-264` | — | confirmed: belief set tight; benign/false alarm: belief pulled **down**; discovery: U-mode; may locate footholds; exposes false tools | The card gives a label and nothing on what changed. A benign verdict lowers the belief even when the case was corrupted. |
| C6 | Case corruption by a sabotaging safety AI | M | Investigate preview "exposure" | — | `safety/covert.ts:242`, `:454` caseThreat | AI share of the work | C5 | Visible only as a probability in the preview. A finished case never shows a "suspect" flag. |

### I. Incidents and responses (13)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| I1 | Incident card: S1–S5, apparent trait / "unexplained" / "misuse", model, internal / customer / public, status | R | Safety › Cases (top) | Something happened | `safety/incidents.ts:263-340`; `safety/view.ts:174` | — | — | Incidents are the main visible proxy of hidden traits. Nothing links an incident to the danger readout that predicted it (D1). |
| I2 | "public in n d · RAISE ≤ 3 d / SB 53 ≤ 15 d" | R | incident card, watch list | Deadline | `safety/incidents.ts:225`, `:96-114` | — | cover-up odds | Fine. |
| I3 | Response menu: Patch signal · Retrain against · Targeted training · Restrict context · Add control · Roll back · Disclose · Investigate | A | incident card | Fix it | `safety/responses.ts:128-227` | varies | — | **A flat menu for every incident.** On "unexplained" or "misuse" incidents, Patch, Retrain and Targeted act on the **most-believed critical trait**, not the cause (`responses.ts:38-43`). **Every non-disclose response closes the incident**: "resolved", or "covered" while a public timer runs, and covered means cover-up risk at ×3 trust loss (`responses.ts:221-225`). No preview says this. Effects change the **truth** at once; beliefs do not move until later observations, so the player sees no effect. The RESPONSE_INFO days (30–90, 14, 21–35) look like durations but are not: apply is instant. |
| I4 | Patch signal ("patched to ×a · floor ×0.2") | A | incident menu | Fix the training cause | `safety/responses.ts:140-148` | SRE 10 for 30–90 d, G −0.02 yr | every later run, lab-wide | One of the clearest verbs, but reachable only from an incident. It is not on the trait graph, where the edges are drawn. Apply does not check that 10 engineers are free. |
| I5 | Retrain against | A | incident menu | Train the trait out | `safety/traits.ts:805` goodhartTrain | none | true −20–40%, visible −70–90%, a mask, OBF +0.1 | A free verb whose cost shows up later as a belief that **looks** fixed. The preview says "hides more than it heals", but the action sits on the same footing as the real fixes. |
| I6 | Targeted training | A | incident menu | Technique-specific training | `safety/responses.ts:94` targetedPlan | G −0.02 yr | immediate trait cut; EA ×2 the first time on a lineage | Overlaps fix methods (T10), Heavy safety (P1) and anti-scheming. There are three ways to apply anti-scheming. |
| I7 | Restrict context | A | incident menu | Limit a product | `safety/responses.ts:174-177` | revenue | usage, misuse and incident opportunity ×0.3 | **One-way**: there is no un-restrict verb anywhere in the engine. On an internal incident it says "no live external product". |
| I8 | Roll back | A | incident menu, model card | Go back to the checkpoint | `safety/responses.ts:191-201` | capability | deployments and lanes move; the version is shelved | Fine. Two entry points. |
| I9 | Disclose | A | incident menu | Tell the world | `safety/responses.ts:202-213` | scrutiny | trust by credibility; U-modes to the world | Overlaps E01's Disclose / Fix quietly / Deny, publishing a result (R6) and the publish policy (O1). |
| I10 | Remove control | A | Control card | Drop the tax | `safety/responses.ts:186-190` | — | — | Not in the incident menu (correct), but the same ActBtn id as the responses. |
| I11 | Apparent vs true source | M | incident label | — | `safety/incidents.ts:44-49`; `safety/covert.ts:73` | — | — | Deliberate. A confirmed case relabels "unexplained" incidents. The player is never told that a covert act can wear another trait's label. |
| I12 | Severity S1–S5 | R | pill | How bad | `safety/incidents.ts:74` drawSeverity | — | public penalty | Fine. |
| I13 | Cover-up | M | invisible until found | — | `safety/incidents.ts:84-114` coverUpDiscovery | — | trust ×3, leak events | The trap behind I3. Only the Disclose preview hints at it. |

### F. Control and footholds (7)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| F1 | Control gauge "0.91 firm" (firm / holding / slipping / weak) | R | Safety › Overview Control card | Could I still stop it? | `safety/control.ts:183-215`; `safety/dangerView.ts:272` | — | — | The loss line is hidden. The bands are "display only", yet "weak < 0.6" equals exposure > 0.4, the published default loss line. The card never connects the two. Control does not feed catastrophe risk (D3). |
| F2 | Drivers: Misalignment est. · Oversight % · Footholds | R | Control card | What drives control | `safety/control.ts:183-204`; `safety/believedOversight.ts:44` | — | — | "Oversight" here is against the POWER act (`CONTROL.trait`). Danger uses per-act oversight; Successor uses R&D oversight; Agents uses catch. Four oversight numbers. |
| F3 | Footholds chip and tab: suspected (symptom, where a case could look, Investigate), located (size, Remove), removed | R+A | Safety › Footholds | Hidden AI assets found | `safety/footholdDetection.ts:145, 176, 225, 265` | SRE | control F | Clear tab. The sizes use five units (H100e, reach, extra pull, copies, strength). |
| F4 | "What to watch for" | R | Footholds tab | How each kind shows | `SafetyControl.tsx:103-126` | — | — | The links go to generic tabs ("Tools", "Lines"), not to a lever. |
| F5 | Remove foothold | A | located row | End its effect | `safety/footholdDetection.ts:212-252` | SRE, agents off for d days, G | control | Its engineers show as "patches" (T5). The agent downtime is not shown on Company › Agents. |
| F6 | Exfiltrated copy, "only the hunt" | M | Footholds | — | `safety/control.ts:155-180` | — | rogue risk row | The hunt is not a player verb on this screen. |
| F7 | Steered successor | M | Footholds | — | `safety/footholds.ts:90`; `safety/covert.ts:352` | — | successor traits | Overlaps Successor pull (P7). |

### D. Danger and catastrophe risk (6)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| D1 | Danger chip "x acts/yr" with D / C / O / eye bars | R | Products cards, Agents lanes | How much harm this deployment does | `safety/dangerView.ts:187`; `Danger.tsx` | — | — | Another summary of beliefs (disposition = est^1.5) in a new unit (acts/yr). It feeds nothing: not control, not catastrophe risk. Not on the Safety panel. |
| D2 | Danger tooltip "What lowers it" (before → after per lever) | R | chip hover | Levers | `safety/dangerView.ts` levers | — | — | Good. It is the only safety readout with honest what-ifs, and it is in an L3 tooltip. |
| D3 | CATASTROPHE RISK x% (band) | R | Top strip gauge | How likely the end is | `shell/selectors.ts:15` catRisk; `actors/intel.ts:93-147` | — | — | The own-model row = P(first) × (0.7·σ((mis − 0.4)/0.06) + 0.3·margin risk) (`intel.ts:108-115`). It **ignores** control, footholds, monitors, danger and incidents. The rogue row is a flat 0.01, or 0.5 when a copy is loose (`:144`). So removing a backdoor, adding monitors or adding control leaves the headline unchanged. |
| D4 | Risk › Sources: rows with drivers, levers, "what one step moves" | R+A | Risk panel | Where risk comes from | `RiskSources.tsx`; `actors/intel.ts:150-171` riskLevers | — | — | Driver shares are constants (0.7/0.3, 0.5/0.5), not computed. The rogue row's levers ("Control research", "Monitors") move nothing: `rogue: []` in riskLevers (`intel.ts:170`). The own-model lever "Tighten eval gate" changes no input of the row. |
| D5 | Rival misalignment band (Risk › Flows, Relations) | R | Risk › Flows | Others' risk | `actors/intel.ts:25-56` | — | catastrophe risk | Outside the player's safety verbs except Joint evals and Publish. |
| D6 | "Belief misalignment −0.05" lever | R | Risk tooltip | — | `actors/intel.ts:157` | — | — | "How: alignment training, fixes from findings". It does not say which verb. |

### P. Safety at training time (11)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| P1 | "Alignment": Standard / Heavy / Minimal / Inoculation | P (per run) | Blueprint | How much safety training | `safety/traits.ts:559` SAFETY_REMOVAL, `:710` HEAL_SAFETY, `:732-735` heavy anti-scheming | t (weeks) | trait removal; EA ×2 the first time; alignment audit | Inoculation is a separate boolean riding in the same slot (`Blueprint.tsx:82, 94`). Heavy silently includes anti-scheming (EA ×2) and an alignment audit when an AG02 WB tool is known. "Alignment" (Blueprint) vs "Safety training" (glossary) vs `safety` (code). The glossary's "standard enables classifiers" has no engine counterpart that I found. |
| P2 | "Rewarded for": Constitution / Engagement / Persuasion / Minimal | P | Blueprint | Preference target | `safety/traits.ts:648-651, 710` | — | E08/E29 ×0.7; heal | Duplicates T-SPEC, which is listed as a fix tool. |
| P3 | "Reasoning": Visible / Pressured / Faithful / Latent | P | Blueprint | CoT mode | `data/v2/runDesign.ts:179-184`; S4 | G, serve FLOP | monitorability, COT detection | Clear, with a pledge warning. |
| P4 | "Data filter": Quality / Hazard / Safety pretraining | P | Blueprint (base) | Filter data | `data/v2/tree.ts:204-205` | G | misuse, S5 | Duplicates T-FILTER (a "fix tool"). The open-weights promise is dead (SAF-05). |
| P5 | Training pressure card: signals S1–S9 with causes, families pushed, ω | R | Blueprint, model card | What this run pushes | `safety/pressureView.ts:85-156`; `Pressure.tsx` | — | — | **ω is used twice**: run "trait movement ω" and "successor pull ω". Signal names differ between screens ("Approval reward" on Pressure, "Rater approval" on the Trait graph). S6 is always 0. |
| P6 | "Risk pressure vs <internal>" arrows per family | R | Blueprint | Will this run make things worse | `Blueprint.tsx:802-812`; `safety/traits.ts:751` predictBeliefs | — | — | The prediction leaves out AG18 heal (SAF-04), detection-based removal (U11) and the audit: `predictBeliefs` builds removal without `det` or `heal`, while `playerEnv` (`:717-735`) applies both. So the preview does not match the result. |
| P7 | Successor pull ω (side tab) and the Blueprint line | R | Safety Overview side tab; Blueprint | Next model inherits from the R&D models | `safety/pressureView.ts:244` | — | next run's traits | Shares a side tab with Risk families, so it is hidden half the time. The levers are links ("Monitors", "Less AI R&D", "cleaner models", the last one not a link). |
| P8 | Version pressure on the model card | R | Models | What a run applied | `Models.tsx:197` | — | — | Fine. |
| P9 | Monitorability meter (0–1) | R | model card, Blueprint | Is reasoning readable | familyPenalty COT (`safety/detection.ts:67`) | — | COT detection | Shown on the model, explained on the pledge. Fine. |
| P10 | Alignment audit | M | invisible (log line) | — | `safety/agendas.ts:197-215` | — | AF/SCHEME observations; foothold location | A free verb hidden inside Heavy + AG02. |
| P11 | RL focus / budget / suites (S2, S3, S7, E09) | P | Blueprint, Suites | Capability settings | `safety/traits.ts:658` (broad: E09 ×0.7) | — | trait pressure | Safety-relevant through P5. Fine. |

### O. Policies and disclosure (5)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| O1 | Publish results: none / selective / all | P | Safety › Policies | How much to share | `safety/actions.ts:346-361`; `safety/findings.ts:393`; `actors/index.ts:38` | lead days | "all" auto-publishes each result; publish pressure 0.15/0.45/0.8 | The preview's numbers ("−10 lead days/yr, +4 cred/yr"; "selective: review each finding (staff)"; "none: −3 cred, −1 talent, +5 lead days") are not what apply does. |
| O2 | Monitorability pledge | P (one-way) | Safety › Policies | Promise readable reasoning | `safety/actions.ts:363-384`; `safety/traits.ts:664` | — | E15 ×0.5, credibility +8, trust +4, commitment | The preview's "progress −0.4" and "lead −30 days" are notional. The pledge blocks nothing; the Blueprint only warns. |
| O3 | Trusted to AI x% (read-only on Safety, ± on Company) | P | Company › Agents (home); Safety Policies | Hand safety work to AI | `departments/agentActions.ts:269`; `departments/workfit.ts` safetyLabour | — | more findings and faster cases; sabotage exposure | The Work tab's reference points to Safety › Research lines, not to the home (`Work.tsx:222`). The glossary also has `automateSafety` (obsolete, points here) and `safetyAgents`, which overlaps it. |
| O4 | Safety agents lane: model, monitor, compute (≤ 60% of safety pool) | A | Company › Agents | Pick the safety model | `safety/agents.ts:19-62` | SPool | O3, sabotage | Takes safety compute before the lines. Not shown on Safety. |
| O5 | Commitments (pause-if-redline, frameworks) | P | Relations / events | Promises | `actors/commitments.ts` | — | E17, E30 | Outside safety's screens. Fine. |

### A. AI doing safety work (4)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| A1 | "Work AI does" % | R | Policies row, line tooltip | Share automated | `departments/workfit.ts` safetyLabour | — | — | "Trusted to AI" (policy) vs "Work AI does" (result). Clear only after reading both tooltips. |
| A2 | Sabotage and sandbagging by the safety model | M | Trusted tooltip footer, Investigate preview | — | `safety/covert.ts:242-275` | — | false results, corrupted cases, slower lines | The only symptom is ETAs slipping (SAF-26). There is no "expected vs observed" readout. |
| A3 | AG17 harness | M | invisible | — | `departments/workfit.ts:360-386` | SSci | safety model fit | SAF-04d. |
| A4 | AG17 level gate "needs a safety model at level ≥ 10" | R | project ready reason | — | `models/tree.ts:249` | — | — | SAF-17. |

### S. Staff, compute and cash for safety (6)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| S1 | Safety science teams (hire, specialty, ×1.5 bonus) | A | Company › People; line picker | Researchers | `safety/agendas.ts:67` lineCapacity | $ | R3 | Staffing also switches mechanisms (R3). |
| S2 | Safety research engineers | A (hire only) | Company › People; upkeep bar | Engineers | `safety/investigations.ts:26`; `safety/lineProjects.ts:247-285` | $ | cases, patches (+ foothold removal), experiments ≤ 50%, upkeep | Fixed priority with no player control (SAF-03). |
| S3 | Safety pool (Compute › Split row "Safety") | P | Compute › Split; Company pools | Safety compute | `safety/agendas.ts:92-108`; `safety/view.ts:207-245` | compute | monitors (first), safety agents, cases (5% each), lines (rest) | **The breakdown is shown nowhere**: `safetyUtilisation.compute` has no UI reader. The glossary `safetyLoad` ("Department load") describes a screen that does not exist. Idle safety compute is invisible. |
| S4 | Eval gate's engineers | M | Models › Evals, Company › Work | — | `models/evals.ts:106-115` | CRE | — | A safety policy spends **capability** engineers. Safety never says so. |
| S5 | Cash for safety | R | lane "Cost/yr", product run cost | — | `Agents.tsx` lanes | $ | — | There is no safety budget total. The cost of monitors appears only per lane. |
| S6 | Progress penalties (patch, targeted training, foothold removal: −0.02 yr each) | M | response previews | — | `safety/responses.ts:62-70` | G | next post-run | The pending total shows only in a preview line. |

### V. Events (5)

| # | Player sees | Kind | Where | Player's view | Engine | Inputs | Depends / feeds | Problems |
|---|---|---|---|---|---|---|---|---|
| V1 | E17 Red flags: Pause & investigate / Continue + control / Continue | A (event) | decision modal | Crisis | `events/catalog/safety.ts:121-165` | lead days, board | 60-day frontier pause, case of 20, control on internal, red-flag count | "Pause frontier runs" exists **only** here. There is no standing verb to pause or slow. |
| V2 | E01 First finding: Disclose / Fix quietly / Deny | A (event) | modal | — | `events/catalog/safety.ts:56-70, 115` | — | — | "Fix quietly" fixes nothing: it only records a cover-up. |
| V3 | E19 The leak | A (event) | modal | — | `events/catalog/safety.ts:167` | — | — | Fine. |
| V4 | E25 Copy loose | A (event) | modal | — | `events/catalog/safety.ts:194` | — | F6, D3 rogue row | Fine. |
| V5 | E30 Framework threshold | A (event) | modal | — | `events/catalog/safety.ts:234` | — | commitments | Fine. |

### G. Vocabulary in the glossary and on screen (3)

| # | Item | Problems |
|---|---|---|
| G1 | Duplicate or obsolete entries | `agenda` / `researchLine`; `technique` / `detector` / "tool" / "method"; `refresh` / `toolUpkeep` / `validatedTo` (plus the hidden validation lead); `automateSafety` / `trustedToAI` / `safetyAgents`; `monitor` / `agentMonitor` / `runtimeMonitoring`; `U` / `gap` / `blind` / `uRange`. |
| G2 | Same word, different thing | `oversight` is the **Oversight committee** (politics), while effOversight, actOversight and rdOversight are three safety quantities. `tiers` is "Control tiers" (autonomy) vs `controlBand` and the control layer. `coverage` is a tool's coverage of a trait, a monitor's coverage of forward passes, and an AI's coverage of work types. `strength` is tool strength and monitor strength. "catch" is a monitor's catch rate, "your tools catch it" (detection), and caught acts. ω is trait movement and successor pull. `clarity` is a belief and a case stock. |
| G3 | Broken links | `[[mask]]` (in `technique`) and `[[evalaware]]` (in `toolFamily`) have no entries. `safetyLoad` describes no screen. |

---

## Part 2. Diagnosis

### 1. The player's safety verbs, by intent

**a. Learn about a model** (what is it really like?)
- Open a case: C1, with five more entry points (C2) and close (C4).
- Evals: gate (E1), order or deepen a suite (E3), external evaluators (E4), auto-evaluate (E5).
- Monitors: their weekly observations (M5) are a side effect of buying catch.
- Research detection tools (R3), keep them working (T5, hire only).
- Alignment audit: hidden inside Heavy safety (P10).
- *Missing:* a direct "run safety evals / red-team this model now" whose result the player can read (propensity rates exist in `v.evals.safety` but are never shown, E2). There is no "verify this tool" verb (T9), no "look for unknown failure modes" verb (B8), and no way to choose a case's tools or compute (C1).
- *Duplicated:* six Investigate buttons. Beliefs move through cases, suites, monitors, audits and drift, and the player cannot tell which one moved them.

**b. Prevent problems in training**
- Blueprint slots: Alignment (P1), Rewarded for (P2), Reasoning (P3), Data filter (P4), RL settings (P11).
- Patch signal (I4), only from an incident.
- Targeted training (I6), only from an incident.
- Fix methods (T10), switched on by staffing lines, not chosen.
- Monitorability pledge (O2).
- *Duplicated:* anti-scheming three ways (Heavy, the T-ANTISCHEME method while AG18 is staffed, targeted training). Constitution twice (P2 and T-SPEC). Inoculation twice (P1 slot and T-INOC). Hazard filter twice (P4 and T-FILTER). Classifiers twice (product safeguards and T-CCLASS).
- *Missing:* choosing which known methods go into a run, with their cost (SAF-05). Patching from the trait graph, where the edges are. A prediction that includes what the engine will actually remove (P6).
- *No visible payoff:* methods and patches change truth; the player sees nothing until later observations.

**c. Contain a deployed model**
- Control layer on/off (M7).
- Monitors: budget on Safety (M1), model on Company (M2), product monitors on Products (M6).
- Restrict context (I7), one-way. Roll back (I8).
- Trusted to AI (O3), safety agents (O4).
- Safeguards and KYC (Products). Weight security (Company).
- *Missing:* un-restrict. A standing pause or slow-down (only E17 has it). Limiting internal agent autonomy or AI share of R&D directly (only through compute shares). Human review (no setting).
- *No payoff:* tool Off (T2).
- *Split:* the monitor verbs sit on three screens with two formulas (M3, M6).

**d. Respond to an incident**
- The flat menu (I3): Patch, Retrain against, Targeted training, Restrict, Add control, Roll back, Disclose, Investigate.
- Remove foothold (F5).
- *Problems:* the menu ignores the incident's cause; for "unexplained" incidents it acts on an arbitrary trait. Any response but Disclose closes the incident and can turn it into a cover-up (I13). Effects are instant on truth and invisible on beliefs. Retrain against sits beside the real fixes as a free option (I5).

**e. Invest in future capability**
- Staff lines and queue nodes (R3, R10). Hire safety science teams and engineers (S1, S2).
- Safety compute split (S3). Trusted to AI and the safety model (O3, O4). Publish (R6, O1).
- *Payoff visibility:* line Health and an occasional tool. "U, if <idea>" is drawn for one idea only, when its ETA is ≤ 17 weeks. Believed U does not fall when research is cut (U1), so under-investing has no visible cost until an incident.

**Verbs whose shown effect is wrong or empty:** tool On/Off (T2); eval gate clarity and credibility (E1); publish policy numbers (O1); pledge costs (O2); RESPONSE_INFO durations (I3); E01 "Fix quietly" (V2); the Policies tooltip saying the gate blocks use (E1); rogue risk levers (D4).

### 2. The player's safety information, by question

| Question | Readouts (IDs) | Count |
|---|---|---|
| Q1 Can I see inside my model? | U, margin, BLIND/AHEAD (U1); likely range (U7); validated to (T6); seen to per family (U5); detection grid (U6); per-trait detection in the race tooltip (U2); "Your tools catch it" (B6); unseen ×3 (U3, U10, B3); clarity (B2); next to fade (T7); n tools fading (T5); tool strength and faded (T4); masked (T8) | 15 |
| Q2 Is my model misaligned? | trait beliefs (B1); family estimate and band (B3); misalignment estimate, band, danger line (B7); risk badges low/watch/unseen (Agents); failure modes found (B8); risk-pressure arrows (P6); red flags (event only, B11) | 7 |
| Q3 Is it doing harm, or about to? | danger acts/yr and D/C/O bars (D1); incidents (I1); attempts and caught per year (D2); footholds (F3) | 4 |
| Q4 Could I stop it? | control and band (F1); oversight ×4 (F2, D1, M10, catch M3); control layer and tax (M7, M8); monitor coverage (M1); collusion tag (M4); human gap (M9) | 9 |
| Q5 How bad is it overall? | catastrophe risk (D3); risk sources and drivers (D4); the own-model row | 3 |
| Q6 Is my safety research working? | Health (R2); results and types (R5); dead ends (R7); ETA (R4); results per year; ideas known (R9); tools gained | 7 |
| Q7 Where do my safety resources go? | engineer bar (T5); Trusted / Work AI does (O3, A1); monitor budget % (M1); lane costs (S5). Safety compute breakdown: **none** | 4 |

**Conflicts**
- *Overall safety* (Q2–Q5): U margin, control, catastrophe risk, misalignment and danger are five headlines built from different inputs on different models (B10). Catastrophe risk reads misalignment and U but not control, footholds, monitors or danger (D3). Control reads misalignment, oversight and footholds but not U. Danger reads beliefs and oversight per act and feeds nothing. Two contradictions follow. A located backdoor drops control and leaves catastrophe risk unchanged. "Understanding ahead" sits next to "3 of 4 families unseen".
- *"Unseen"* has three definitions (U3, U10, B3).
- *Oversight* comes in four versions (F2, D1, M10, M3), and the shown catch rate is not the one used (M3).
- *Thresholds and colours*: 0.15/0.3, 0.3, 0.05/0.2/0.4/0.7, 0.2/0.4, and 0.4 used as both a misalignment line and an exposure line (B3, B7, F1).
- *Model choice*: internal, selected, lowest, or per deployment, depending on the readout (B10).
- *Units*: beliefs are 0–1, the Agents tooltip shows the same estimate as a %, danger is in acts/yr, control is 0–1, risk is %, U is in levels, upkeep is in OOM per days.

**Readouts that answer no question the player can act on:** strength and "faded" on fix tools (T4); line compute share (R9); edge weights w̄ and grades (B5: no verb acts on an edge there); κ on successor pull (P7); "Spent H100e" on monitors (M1: it shows the spend, not what is lost); Goodhart G in the Codex; driver shares on risk rows (D4: constants).
**Hidden answers (computed but not shown):** behavioural safety eval rates (E2); the safety compute breakdown (S3); the gap's effect on trait growth (U9); detection's effect on training removal (U11); what a staffed line switches on (R3).

### 3. Concepts the player must learn

Counted as distinct on-screen terms: **58**, falling into five clusters with heavy overlap.

- **Seeing (16):** detection, tool strength, tool coverage (of a trait), half strength, faded/decay, tool upkeep, validated to, understanding U, likely range, margin/gap, blind, seen to, unseen, clarity, mask/Goodhart, tool family (BB/COT/WB/OR).
  - Overlaps: U / validated to / seen to / detection grid all answer "up to what level can I see". Clarity vs detection: one is "how sure the belief is", the other "how well tools would read it", and "unseen" mixes them.
- **Stopping (15):** monitor (product), monitor (internal), monitor coverage, monitor strength, catch rate, collusion, containment/block, control layer, control tax, deferral, human review, gap above humans, oversight gap, effective oversight, R&D oversight. Control (believed) and control band make it 17.
  - Overlaps: catch vs oversight vs containment vs control. Catch has three senses, oversight four (plus the political committee).
- **Model state (13):** trait, belief (est ± sd), trait kind (4), risk family, misalignment, danger line, disposition, danger (acts/yr), red flag, U-mode, foothold (5 kinds), severity, apparent cause.
- **Research (9):** line/agenda, health, serious staffing, project/follow-up, result/finding (7 types), tool/technique/method/detector, dead end, efficacy (hidden), trusted to AI / work AI does.
- **Training (5 beyond the run slots):** signal S1–S9, training pressure, ω (two meanings), edge/moderator/evidence grade, patch.

The worst single-word collisions: coverage (3 meanings), catch (3), oversight (4 + committee), clarity (2), strength (2), ω (2), control (believed / layer / tiers / band). A player must also learn that "fix" tools are switched by staffing, that "detect" tools also train, and that "blind" is a cause, not only a symptom.

### 4. Resource flows for safety

| Resource | Who competes for it | Order / rule | Player control | Visible? |
|---|---|---|---|---|
| Safety science teams | research lines (and nodes on the tree); auto-assign | Teams on lines; staffing also switches on fix methods, AG07 monitoring, AG18 heal, the AG17 harness | Assign / take off | Teams yes; **side effects no** (R3) |
| Safety research engineers | cases (5–40 each) → patch (10) + foothold removal → line experiments (≤ 50% of the rest) → tool upkeep | Fixed priority (`safety/lineProjects.ts:247-285`) | Only hire, and case size | A bar, with removal mislabelled "patches"; no ordering (T5) |
| Capability research engineers | eval suites (gate, orders, re-runs) vs capability research | Evals queue | Gate level, depth | On Models › Evals and Work only; **Safety never says the gate spends them** (S4) |
| Safety compute pool | monitors (budget share, **first**) → safety agents (lane share ≤ 60%) → cases (5% each) → line experiments (the rest, ∝ engineers × computeRef) | `safety/agendas.ts:92-108` | Split row, monitor budget ±, agent lane ±; case share not settable | **No breakdown anywhere** (S3). Raising monitors silently starves lines. Idle is invisible. |
| Serving compute | product monitors (+overhead), restriction (×0.3 usage) | — | Product monitor pick | Per product |
| Capabilities AI labour | control tax | Under the control layer | Add / remove control | On lanes and the Control card |
| Progress (G) | patch, targeted training, foothold removal (−0.02 yr each, pending) | Next post-run | Choosing those responses | Preview line only (S6) |
| Cash | hiring, compute; monitor and agent cost per lane | — | Hiring, split | **No safety budget total** (S5) |
| Lead days / credibility / trust | publish, publish policy, eval gate, pledge, disclose | — | Those verbs | Previews (some wrong, O1, E1) |

The player can see headcount and that engineers are busy. They cannot see the safety compute split, the engineer ordering, or that two safety policies (monitor budget, eval gate) take from research and capability.

### 5. The 10 biggest sources of confusion, ranked

1. **No single answer to "how safe am I?"** U margin, believed control, catastrophe risk, misalignment and danger are five headlines with different inputs and models, and they can disagree (control falls, catastrophe risk does not; `actors/intel.ts:108-115, 144`). *Hint:* one causal chain (beliefs → danger → control → risk) with one home per link.
2. **Staffing a line is the hidden on-switch for training methods and monitoring effects** (R3, T10, SAF-04), and fix tools show a strength that does nothing (SAF-07). The player cannot tell what a line buys besides "results". *Hint:* a method is an owned item ticked per run.
3. **The response menu is flat and has traps.** It is the same 7 verbs for every incident. Unexplained incidents get an arbitrary target trait. Any non-disclose response closes the incident and can become a cover-up. Effects land on truth with no visible change. Retrain against sits beside real fixes (I3, I5, I13). *Hint:* responses offered per cause, with their effect on what the player will next observe.
4. **The "seeing" vocabulary is overloaded.** U, validated to, seen to, detection %, clarity, three meanings of unseen, blind, tool strength and three meanings of coverage all answer variants of "can I see it", across the top strip, Overview, Research lines and the Trait graph (U1–U10, B2). *Hint:* one detection quantity, one level readout, and the belief's sd.
5. **The "stopping" vocabulary is overloaded.** Four oversight numbers, three catches, containment with no home, and "control" as believed level, layer, band and autonomy tiers (F2, M3, T11, G2). *Hint:* per act: blocked, caught, harm, one name each.
6. **Monitors are split across three screens with two formulas and two budgets.** The displayed catch is not the catch used. The default package is a self-monitor (collusion). A monitor's other two jobs (observations, foothold suspicion) are invisible (M1–M6).
7. **Safety resources are invisible and uncontrollable.** There is no safety compute breakdown. Engineers follow a fixed hidden order. The monitor budget and cases silently take from research. The eval gate spends capability engineers (S2–S4, T5). *Hint:* one ordered needs list per pool, with idle shown.
8. **Safety at training time is duplicated and mispredicted.** The same method appears as a Blueprint option, a fix tool, inside Heavy and as a response. "Detect" tools and the eval gate change training edges. The Blueprint prediction leaves out heal, detection-based removal and the audit (P1–P6, T3, U11).
9. **Previews and labels that do not match effects:** tool Off (T2), eval gate clarity and credibility plus "used or sold" (E1), publish policy (O1), pledge (O2), response durations (I3), "Fix quietly" (V2), rogue levers and constant risk drivers (D4). *Hint:* previews run the mechanism on a copy.
10. **Blind is a cause, but the UI shows it as a view.** The true gap speeds trait growth (U9) and believed U does not fall when research is cut (U1), so under-investing in safety shows no cost until incidents arrive. The race bar reads as "how much I can see", not "how fast things get worse". *Hint:* show the drift the gap causes and the uncertainty when research is thin.
