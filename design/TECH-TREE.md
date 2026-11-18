# Tech tree (draft v2 for review)

Status: **draft v2, 2026-11-16.** Part of [STRUCTURE.md](STRUCTURE.md) §4.2. No code changes until approved.
v2 changes: one shared tree (capability and safety mixed), no capability gates, research as projects with teams
assigned, no 150-day cap, serving cost grows with size and falls with efficiency techs.

## 0. Philosophy

1. **Research makes knowledge; development builds things.**
2. **A node is an idea.** You can research it once you know its prerequisites. Its effort says how hard it is.
3. **Knowledge is gated only by knowledge.** Never by your current model. Some ideas pay off only with a capable
   enough model, or enough compute; the card shows how much they pay off *now*.
4. **Ideas are rarely pure capability or pure safety.** Every node shows both effects, and many trade one for the
   other.
5. **Unlocking is not using.** An unlocked idea is used by building something with it: a model (training), a product
   (engineering), or a lab-wide practice.

The tree holds everything the lab can learn: architectures, data, training methods, reasoning, agents and tools,
efficiency, research automation, alignment methods, interpretability, evals, control, safeguards, product features.
It is built from content the engine already has (paradigms P01–P27, locked run-design options, safety techniques
T-…, agendas AG01–AG18). New nodes are marked **new**.

---

## 1. How it works

### 1.1 Columns are expertise, not departments

| Column | Science teams with this specialty work faster here | Mostly |
|---|---|---|
| Pretraining | Pretraining scientists | Architecture, data, scale engineering |
| Post-training | Post-training & RL scientists | RL methods, reasoning, learning styles |
| Systems | Systems & agents scientists | Inference, agents, efficiency, research automation, product features |
| Alignment | Alignment scientists | Training methods that shape values and honesty |
| Interpretability | Interpretability scientists | White-box tools |
| Evaluation & control | Evals & control scientists | Evals, monitors, control protocols, safeguards |

Prerequisites cross columns freely. Examples: *CoT monitor* (Evaluation) needs *Visible reasoning* (Post-training);
*Faithful-CoT architecture* (Pretraining) needs *CoT monitor*; *Interp-guided training* (Post-training) needs
*Linear probes* (Interpretability).

The tree is drawn left to right by **depth** (how many ideas it builds on), not by date or capability; the six
columns of expertise are drawn as horizontal lanes.

### 1.2 Research projects

- A node you can research is a **project**. Its effort is in scientist-team-months at reference research speed.
- You **assign science teams** to projects. Progress per day = research speed × Σ (team size × quality × 1.5 if the
  team's specialty matches the column) with diminishing returns per project (square root of the assigned capacity),
  so spreading teams over several projects is often better than piling on one.
- Research speed is the lab's research multiplier: experiment compute, AI agents and the takeoff loop speed up
  frontier research as they speed up everything else.
- **AI science (J2):** frontier-research agents add capacity on capability projects: × 1/(1 − Φ(sdAI) × coverage), up to
  ×2, where Φ(sdAI) is the share of human scientists the frontier model's taste beats and coverage its compute share ÷ the
  reference 15%. Fitted efforts include it, so the reference lab's project dates hold.
- **Policy (J2):** auto-assign spreads science teams over the ready projects *in the queue* (it never picks unqueued
  ones): a project with no team gets one first (queue order, specialty first), every other team goes where it cuts the
  most days off a project's ETA × 0.5^(queue rank). The policy's teams re-spread when a project finishes or a ready
  project has no team; teams placed by hand and teams on research lines stay. The team picker shows the days each team
  would cut. Zero clicks by default.
- There is no point balance. Progress lives on the project.

### 1.3 Odds and results

Every project shows its odds before you start.

| Kind of node | Odds shown | Hidden |
|---|---|---|
| Capability ideas (paradigms) | A known chance (the paradigm prior) | The roll. Outcomes are drawn per world: some ideas don't work in this world. A failure says so; you can retry after 180 days at half the previous odds (shown on the card). |
| Safety ideas (techniques of an agenda) | The research line's **estimated** efficacy (Promising / Mixed / Struggling), from results so far | The line's true efficacy. Each result updates the estimate: works well, works weakly, dead end, or (rarely, with AI labour) a false result that is found out later. |

### 1.4 Layers: what using a node needs

| Layer | What it is | To use a newly unlocked node |
|---|---|---|
| **Backbone** | Architecture, data, size | New base run, then post-training |
| **Training** | Post-training: RL, alignment training, reasoning style | Post-training run on an existing base |
| **Scaffold** | Inference-time: tools, memory, effort, safeguards, product features | Engineering build (team-weeks + cash), no training |
| **Lab** | Research automation, detection tools, efficiency practices | Applies at once |

The blueprint shows each slot's layer and the cheapest rebuild that delivers a change.

### 1.5 Size is a decision

The player sets the base run's size (FLOP) freely; snap points ×¼ … ×8 of today's frontier run. The tree never caps
it. Limits are resources, all shown on the blueprint:

| Limit | Rule |
|---|---|
| Compute × time | Wall time = FLOP ÷ (training compute × run share) |
| Staleness | A base embodies the know-how of its **start** date; the card shows "behind at finish". This replaces the 150-day cap |
| Data | Tokens needed ∝ √FLOP; short of data → data-wall penalty |
| Cash | Compute-equivalent cost + data + RL environments |
| Restart risk | Rises with size; *Fault-tolerant training* halves it |
| **Serving cost** | ∝ √(size ÷ frontier) × architecture factor × efficiency techs. Bigger = smarter but dearer to serve and fewer agent copies. Distilling, MoE, quantization, kernels reduce it |

---

## 2. Nodes

★ = known at the start by every company (public knowledge in Jul 2025). Each start type adds the nodes its real
analogues had (§5 T3). Effort: S, M, L,
XL. **Pays off** = a condition on usefulness, not on unlocking.

### 2.1 Pretraining (Backbone unless noted)

| Node | Needs | Effort | Odds | Capability | Safety | Cost / pays off |
|---|---|---|---|---|---|---|
| MoE ★ | — | — | — | Reference; serve × 0.5 vs dense | — | — |
| Dense ★ | — | — | — | Δp −0.24 | Restart −10% | Serve 1.0 |
| Quality filter ★ | — | — | — | Reference data | — | — |
| Code & math data ★ | — | — | — | CODE +0.6, RSCH +0.4, CYBER +0.4, SOCIAL −0.4 | — | — |
| Science data | — | S | 95% | BIO +0.8, REASON +0.4 | bioUplift flag risk | +5% cash |
| Native multimodal | — | M | 90% | AGENCY, MEDIA +0.6, PHYS +0.5; no data wall | — | +20% FLOP |
| Overtrained compact | — | S | 95% | Δp −0.36 | — | Serve 0.3; tokens × 5 |
| Fault-tolerant training **new** | — | M | 90% | — | — | Restart risk × 0.5 |
| Synthetic data flywheel (P10) | Code & math data | L | 80% | Synthetic data × 3; +0.15 y data mix | U01 × 1.5; inherits teacher traits | Pays off with a teacher model |
| Long-horizon human demos (P12) | — | L | 85% | h80 × 2; RSCH +0.4 | — | $1B data cost |
| Faithful-CoT architecture (P23) | CoT monitor | L | 75% | Δp −0.24 | Monitorability 0.98 | Serve × 1.2 |
| Neuralese recurrence (P17) | Visible reasoning, Long context | XL | 70% | +0.40 y | **CoT monitoring dies** (monitorability 0.05) | Serve 0.2 |
| AI-designed successor (P24) | Automated research agents, Learned research taste | XL | 60% | Next base +0.8 y | New lineage: traits redrawn, tools may not transfer | Pays off with research done mostly by AI |

### 2.2 Post-training (Training unless noted)

| Node | Needs | Effort | Odds | Capability | Safety | Cost / pays off |
|---|---|---|---|---|---|---|
| Visible reasoning (reasoning RL) ★ | — | — | — | Baseline reasoning | Monitorable CoT | — |
| Agentic environments ★ | — | — | — | Baseline agents | — | — |
| Hardened graders ★ | — | — | — | Reference RL | Reward hacking × 0.4 vs cheap | Env budget cash |
| Engagement tuning ★ | — | — | — | Appeal 1.2 | Sycophancy pressure high | — |
| Persuasion tuning ★ | — | — | — | SOCIAL +0.8 | Persuasion flag; honesty − | — |
| RL focus: math · SWE · ML research · long tasks · cyber · bio | Agentic environments | S each | 95% | Domain levels per family | Signals per family (e.g. long tasks → power-seeking pressure) | — |
| Computer use (P06) | Native multimodal | M | 90% | computerUse RL family | Overreach incidents | — |
| Continual learning (P08) | Long context | L | 70% | Stream runs (κ = 1) | Evals go stale; drift | 15% of the training pool, shown in the run queue |
| Test-time training (P09) | — | M | 60% | REASON +0.6 | Audit coverage −10% | — |
| Self-play curricula (P11) | RL focus: math | L | 60% | REASON +0.8, CODE +0.4 | Verifier hacking pressure | — |
| Iterated distillation & amplification (P18) | Multi-agent orchestration | L | 65% | +0.25 y per 21-day cycle | Traits × 1.1 per cycle | 30% of the training pool per cycle |
| Interp-guided training (P14) | Linear probes | M | 60% | — | In-run trait growth × 0.6 | Goodhart on the probe |
| Brain-like sample efficiency (P21) | Continual learning, Learned research taste | XL | 45% | PHYS +1; fast domain gains | Evals lag | — |

### 2.3 Systems (Scaffold unless noted)

| Node | Needs | Effort | Odds | Capability | Safety | Cost / pays off |
|---|---|---|---|---|---|---|
| Test-time compute ★ | — | — | — | Effort low / max | — | Tokens |
| Distillation ★ | — | — | — | Mini variants (−0.30 y, serve × 0.25) | Inherits traits | — |
| Chat ★ · API ★ · Enterprise ★ | — | — | — | Products | — | — |
| Quantization **new** | — | S | 95% | — | — | Serve × 0.8 |
| Speculative decoding **new** | Distillation | S | 95% | — | — | Serve × 0.85 |
| Multi-agent orchestration (P05) | Test-time compute | M | 95% | Deep-think effort; agent throughput × 1.3 (Lab) | Many-copies pressure + | Tokens × 10 for deep think |
| Long context + memory (P07) | — | M | 90% | h80 × 1.5; memory feature | Memory → successor-risk pressure | — |
| Agents product **new** | Agentic environments | M | 95% | Agents product | Overreach exposure | Pays off when time horizon ≥ the tasks sold |
| Coding agent **new** | RL focus: SWE, Agents product | S | 95% | Agents in Software & IT +0.5 L | — | — |
| Voice & vision **new** | Native multimodal | S | 95% | Consumer appeal + | — | — |
| Deep research **new** | Multi-agent orchestration | S | 95% | Consumer and enterprise quality + | — | Tokens |
| Sector packs **new** (today's sector products) | Enterprise | S each | — | Sector level +0.5 | — | Cash, build time |
| Automated AI research agents (P13) — Lab | RL focus: ML research | L | 75% | Experiment throughput × 1.5 | Sandbagging, U17 ↑ | Pays off in proportion to your internal model's RSCH level |
| AI kernels / HW co-design (P16) — Lab | Automated research agents | M | 80% | Training FLOP × 1.15 | — | Serve × 0.75 |
| Learned research taste (P19) — Lab | Automated research agents | L | 60% | Removes the RSCH −0.5 penalty | AI sets research direction | Pays off once AI taste nears human taste |
| AI-assisted oversight (P15) — Lab | Automated research agents | M | 60% | — | Hardened graders at the cheap price | Collusion risk (U19) |
| Massive agent societies (P20) — Lab | Multi-agent orchestration | M | 80% | Agent throughput × 1.1 | Many-copies pressure max; collusion | Pays off with ≥ 2M H100e of agents |
| Robotics foundation (P22) — Backbone | Native multimodal | L | 60% | PHYS +2; robotics progress | Physical reach | — |
| Superhuman persuasion (P26) | Persuasion tuning | M | 80% | Relation actions × 1.5 | Manipulation | Pays off with SOCIAL ≥ 12 |
| Formal verification at scale (P25) — Lab | Self-play curricula | L | 50% | — | Security +0.5 | — |

### 2.4 Alignment (Training unless noted)

Odds = the research line's estimate (§1.3). The agenda id says where the hidden efficacy comes from.

| Node | Needs | Agenda | Effort | Capability | Safety | Cost / pays off |
|---|---|---|---|---|---|---|
| Constitution / spec ★ | — | AG18 | — | Appeal 1.0 | HONEST +0.05; generalising removal | 8 safety FTE-weeks per run |
| Environment hardening ★ | — | AG18 | — | — | Patchable reward signals | — |
| Honesty & confession training | Constitution | AG18 | M | — | Concealment removal | — |
| Inoculation prompting | Environment hardening | AG18 | S | — | Hacking → bad persona × 0.15 | — |
| Hazard data filtering — Backbone | — | AG15 | M | Δp −0.02; BIO −1.0 | Survives fine-tuning (open weights) | — |
| Safety pretraining — Backbone | — | AG15 | M | Δp −0.02 | Situational-awareness pressure −; U07 × 0.5 | — |
| Persona vectors | Activation steering | AG03 | M | — | Sycophancy / persona fix | — |
| Weak-to-strong training | Honesty & confession | AG06 | M | — | Sycophancy / proxy fix | — |
| Unlearning | Hazard data filtering | AG15 | M | BIO / CYBER − | Misuse removal | — |
| Anti-scheming training | Honesty & confession, Linear probes | AG18 | L | — | SCHEME −90% | **Eval awareness × 1.5** |
| Corrigibility target | Weak-to-strong training | AG12 | XL | — | CORRIG + | Long shot |

### 2.5 Interpretability (Lab: detection tools)

| Node | Needs | Agenda | Effort | Detects |
|---|---|---|---|---|
| Noise-injection elicitation ★ | — | AG02 | — | Sandbagging |
| Linear probes | — | AG02 | M | Alignment faking, scheming, concealment |
| Activation steering | — | AG03 | S | Sycophancy, persona, eval awareness |
| SAE feature search | Linear probes | AG01 | L | Persona, eval awareness, scheming |
| Deception probe | Linear probes | AG02 | M | Alignment faking, scheming, concealment, sandbagging |
| Dev-interp phase detector | SAE feature search | AG13 | M | Training gaming (during training) |
| Activation verbalizer | Deception probe | AG02 | L | Eval awareness, training gaming, successor risk |
| Eval-awareness suppression | Activation steering | AG03 | M | Eval awareness |
| Circuit tracing | SAE feature search | AG01 | L | Scheming, alignment faking, concealment |
| Enumerative audit | Circuit tracing | AG01 | XL | Nearly all critical traits (long shot) |

### 2.6 Evaluation & control (Lab tools; Scaffold for safeguards)

| Node | Needs | Agenda | Effort | Effect |
|---|---|---|---|---|
| Model organisms ★ | — | AG08 | — | Detects; reveals failure modes |
| Trusted monitoring ★ | — | AG07 | — | Contains power-seeking, scheming, collusion |
| Misuse classifiers ★ — Scaffold | — | AG16 | — | Misuse × 0.7; serving cost + |
| KYC tiers — Scaffold | — | — | S | Distillation access × 0.75 per tier; demand −2% per tier |
| Propensity evals | Model organisms | AG08 | M | Detects reward hacking, sycophancy, power-seeking |
| CoT monitor | Visible reasoning | AG09 | M | Detects hacking, concealment, faking, scheming; **useless on latent reasoning** |
| Comms lockdown | Trusted monitoring | AG07 | S | Contains collusion, successor risk |
| Auditing agents | Propensity evals, Agents product | AG08 | M | Detects proxy goals, persona, hacking |
| Realistic honeypots | Propensity evals | AG08 | M | Detects power-seeking, successor risk, faking |
| Debate | Propensity evals | AG05 | L | Detects sycophancy, hacking, concealment |
| Monitorability suite | CoT monitor | AG09 | M | Detects obfuscated reasoning |
| Collusion evals | Comms lockdown | AG14 | M | Detects collusion, successor risk |
| Resample protocols | Trusted monitoring | AG07 | M | Contains power-seeking, scheming |
| Control evaluation | Resample protocols | AG07 | M | Measures containment |
| Automated alignment research (AG17) | Automated AI research agents | AG17 | L | Lets the safety AI-labour policy exceed 50%; pays off with a safety model at L ≥ 10 |
| Mechanistic anomaly detection | Circuit tracing | AG04 | XL | Long shot |
| Harm-probability guardrail | Control evaluation | AG11 | XL | Long shot |
| Verified gatekeeper | Formal verification at scale | AG10 | XL | Contains exfiltration (long shot) |
| Automated alignment research at scale (P27) | Automated alignment research | AG17 | XL | Safety research speed × (1 + 3·AI labour); false-result risk ∝ hidden sabotage |

**Tool upkeep without chores.** A detection tool works up to a capability level. Safety research engineers
(STRUCTURE §4.1) keep that level rising with your models; the readout shows how far ahead it is. No refresh projects.

---

## 3. UI (to mock up)

- **Research screen:** the tree, left to right by depth, six coloured columns. Node cards: name, icon, effort,
  odds, layer badge, capability and safety arrows. Locked nodes show their missing prerequisites as lines.
- **Projects bar:** active projects with assigned teams, progress and ETA; a queue; drag a team onto a project to
  assign it.
- **Node card (L2):** effect on capability and safety, cost, pays-off condition, prerequisites, what it unlocks.
- **Research lines (safety):** health band per agenda and a "spent on dead ends" counter.

## 4. Calibration

| Item | Rule |
|---|---|
| Capability projects | Effort set so the reference team mix finishes each near the RefBot paradigm adoption date |
| Safety projects | Expected time to a line's first result = T₁ at serious staffing (R14) |
| No capability gates | Effort and depth replace them; bot games check that beelining stays a strategy, not an exploit |
| Size freedom | Reference lab trains 1F; serving cost at 1F unchanged |
| Odds | Paradigm priors and agenda efficacy draws, unchanged |

Gates before merge: identity test, golden timelines, all bot criteria at 200 seeds, revenue targets.

## 5. Decisions (2026-11-16)

| # | Question | Decision |
|---|---|---|
| T1 | Retry after a failed capability idea | Today's rule: retry after 180 days, at half the previous odds each time. The card shows the retry date and the new odds |
| T2 | Specialty bonus | ×1.5 in its column, ×1 elsewhere |
| T3 | Known nodes at the start | Each start type begins with the nodes its real analogues had (e.g. a frontier leader knows more of the tree than a spinout); set with the start values (STRUCTURE §4.8) |
