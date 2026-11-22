# Safety redesign: from first principles

Step 2 of the safety redesign (DECISIONS.md: it replaces DD-15 / DD-16). Input: SAFETY-INVENTORY.md (items R1–G3, the
"inventory"), research-safety(.verified).md (SAF-xx, SAF-Vxx), SYNTHESIS.md themes A, M, O, R, V, W, and the sourced notes
in the repo: research/04, 05, 06, 14, 20 (§F, §G), design/MODEL-V3.md §10–11, design/V2-SPEC.md §3.5, and the engine
headers of safety/control.ts and safety/footholds.ts. Hidden truth stays hidden. Every rule below is about what the
player owns, does, sees and is told about the reliability of what they see.

Bracket tags: [S] sourced in the repo's research files (file and section given), [D] design value with no source,
[R] needs a research task before it is built.

---

## 0. The redesign in ten lines

1. Safety is organised the way real labs argue it in a **safety case**: for each harmful act, the model *won't* try
   (alignment), *can't* do it (inability), or *wouldn't get away with it* (control) [S: research/06 E02; GDM FSF v3,
   RSP v3, Preparedness v2 in research/06 §2.11]. The engine already has exactly this product:
   `rate = disposition × capability × opportunity × (1 − oversight)` (MODEL-V3 §11.3). The UI is rebuilt around it.
2. **One table per model** of about 12 harmful acts, with four factors each (*Would try · Able to · Chances · Stop rate*)
   and one result (*Unstopped per year*). Everything else either feeds one factor or is derived from the table.
3. **One headline: Loss-of-control risk** (a % with a range), the believed odds of the very check the endings run (the
   exposure test in safety/control.ts). It reads control, footholds and monitors, so the D3 contradiction goes. One
   companion: **Unstopped harm per year** (the sum of the table, by severity).
4. 58 concepts become **12** (§2). "Coverage, catch, oversight, clarity, strength, control, understanding, danger,
   catastrophe risk, misalignment index" all go or collapse into one of them.
5. Three bins of owned things, one verb each: **Instruments** (see), **Safeguards** (stop), **Methods** (fix in
   training). Nothing is switched on by staffing a line (kills SAF-04, R3, T10).
6. An instrument's **Reliability** is *measured* by validating it on the current model with planted behaviour (model
   organisms, auditing games), not drifted by an upkeep crew. Unvalidated on a new model = extrapolated, wide range.
7. **One monitor formula** for products and internal agents: watched share × flag rate × action rate, with the watcher
   model's capability gap and collusion (kills M3/M6 split).
8. Incidents get **cause-aware responses**; fixing and disclosing are separate decisions, so a fix never silently
   becomes a cover-up (kills the I3/I13 trap).
9. A **Safety framework** (owned policy: thresholds → required safeguards, pause rules) runs releases and internal
   deployments automatically and replaces the eval gate toggle, red-flag event triggers and the missing pause verb.
10. Unsourced amplifiers go: the blind-gap growth multiplier (U9), the validation lead (U8), the half-point upkeep drift
    (T5), belief drift with time (B9), the dead-end latch (R7). Each is replaced by a sourced mechanism or deleted (§6).

---

## 1. The player's safety job

**In one paragraph.** You run models whose real dispositions you cannot see. Your job is to keep the harm they could do
without being stopped low enough that you would bet the company, and the world, on it, while still racing. You do it
with three kinds of owned things: **instruments** that tell you what a model is like (and how far to trust them),
**safeguards** that stop what a model might try, and **methods** that make the next model better in training. Every
model you train is more capable than the ones your instruments were checked on, so your sight erodes unless you keep
validating and researching; every safeguard costs speed, and every hour of AI-done safety work is done by a model you
are not sure about. Nothing ever shows a green tick [S: research/04 §1.0 #8, research/14 §1.0 #7]; you act on
beliefs with stated reliability.

**The six questions safety must answer** (every readout in §4 answers one of them; a readout that answers none is cut):

| # | Question | Short name |
|---|---|---|
| Q1 | What do I believe this model is like, and how sure am I? | *Beliefs* |
| Q2 | What could it do, what stops it, and how bad is the rest? | *Risks* |
| Q3 | How far can I trust my instruments on this model? | *Instruments* |
| Q4 | How do I learn more, and what will that buy? | *Learn* |
| Q5 | How do I fix or contain what I find, and what will that cost? | *Fix* |
| Q6 | Is my safety capacity keeping up with capability? | *Keeping up* |

---

## 2. The core model in plain words

### 2.1 What real labs do (the sources this model mirrors)

- **Frontier safety frameworks** set capability thresholds (bio/chem, cyber, AI self-improvement, autonomy) and the
  safeguards required at each; GDM FSF v3 adds safety-case reviews for large *internal* deployments; RSP v3 adds
  "high-stakes sabotage" and risk reports covering internal models [S: research/06 §2.11].
- **Safety cases** argue inability, control, or alignment, and are only as good as the evidence (AI 2027: Safer-4's case
  "mostly written by the AIs") [S: research/06 E02, §2.1].
- **Evaluations**: dangerous-capability evals (can it?) and alignment/propensity evals (would it?). Behavioural evals are
  confounded by eval awareness: Opus 4 blackmail 55.1% when it believed the scenario real vs 6.5% when it believed it an
  eval; NLA-measured unverbalised test awareness 26% on SWE-bench Verified vs <1% on real traffic [S: research/05 §1.7].
- **Interpretability**: probes catch model-organism sleeper agents at AUROC > 99% [S: research/06 §2.6, research/20 F6],
  but deception probes are "insufficient as a robust defence" and can be driven from 100% to 0% recall by obfuscation
  training [S: research/14 §1.0 #4]. Probes and SAEs are trained per model.
- **Auditing games and model organisms** measure detector recall: 3 of 4 blue teams found a planted objective, the
  black-box-only team failed; in the UK AISI sandbagging game the red team won (1/5 correct with black-box + probes)
  [S: research/06 §2.9].
- **CoT monitoring** works while reasoning is legible and unpressured; training against the monitor produces
  obfuscated reward hacking (Baker 2025); CoT controllability rose 1.7% → 16.1% → 60.9% over three generations
  [S: research/06 §2.7, research/14 §1.0 #3].
- **AI control** assumes the model may be scheming and bounds damage: trusted monitoring 62% safe at 97% usefulness,
  92% at 83% with 20% deferral; Ctrl-Z resampling 58% → 7% attack success at 5% usefulness cost; a weaker overseer at
  a 400-Elo gap succeeds 9–52% [S: research/20 F4].
- **Training fixes**: inoculation prompting cuts emergent misalignment 75–90%; anti-scheming training cuts covert
  actions 13% → 0.4% but roughly doubles eval awareness; chat-style RLHF fixes chat evals while "misalignment persists
  on agentic tasks"; backdoors survive safety training, and adversarial training teaches models to hide triggers
  [S: research/20 F2, F5, F6; research/06 §2.3–2.4].
- **Incident reporting** has legal clocks (SB 53 15 days; RAISE 72 h) [S: inventory I2; research/17 via V2-SPEC].
- **AI 2027's failure path**: 1% of compute on alignment, neuralese, shared memory, training on detector signals, an
  AI doing the alignment research that sabotages it; the success path pays the monitorability tax, locks shared
  memory, cross-examines isolated copies, reboots an older model [S: research/06 §2.1].

### 2.2 The twelve concepts

Each has one name, one meaning, one unit and one home screen. Shared concepts from other screens (model, measured
level, research project, chance it works, AI share, person-month) are not counted.

| # | Name (UI) | Meaning | Unit | Answers | Home |
|---|---|---|---|---|---|
| 1 | **Trait** | A tendency of one model, e.g. *games tests*, *fakes alignment*, *notices tests*, *seeks power*. Hidden. Protective traits are shown the same way round ("dishonesty", "resists correction"). Grouped into the four families for display only. | % of chances where it would do it if it thought no one was watching | Q1 | SAFETY › Model |
| 2 | **Belief** | Your estimate of one trait in one model: best guess and 90% range, built only from evidence, each piece listed with the instrument that produced it. "Unknown" = the range is wider than 30 points (the only meaning of unseen). | % with range | Q1 | SAFETY › Model |
| 3 | **Instrument** | An owned way of reading traits, produced by research: *behavioural tests* (evals, honeypots, red-teaming), *reasoning reading* (CoT monitor), *internals* (probes, SAEs, verbalisers), *real-use logs* (what safeguards' monitors see in deployment), *formal checks*. | an owned item with a version | Q3, Q4 | SAFETY › Instruments |
| 4 | **Reliability** | The chance an instrument shows a trait that is present, on one model. Measured by validation on that model; otherwise extrapolated from the last validated model (wider range). Lists its reasons: *model notices tests −x*, *trained against on V5*, *reasoning not legible*, *not ported to V6*. | % with range, "validated on V5" | Q3 | SAFETY › Instruments |
| 5 | **Sight limit** | The highest capability level at which your instruments together still read the hidden-goal traits at ≥ 50%. Derived from 4 and the known decay of each instrument kind. Shown beside the frontier level: this is the capability-vs-understanding race. | capability level L, with range | Q6 | SAFETY header; TRAINING (planned run) |
| 6 | **Harmful act** | A concrete thing a model could do (about 12, in three groups, §2.4). Four factors: **Would try** (from beliefs), **Able to** (from measured capability against the act's threshold), **Chances** (from the deployment: copies, autonomy, access), **Stop rate** (from safeguards). Result: **Unstopped per year**. | acts per year, by severity | Q2 | SAFETY › Risks |
| 7 | **Safeguard** | An owned measure on a deployment that stops acts: a monitor (watcher model + instrument + watched share), a control protocol (defer / resample / edit), human review, a restriction (cuts Chances), weight security, comms lockdown. Output: Stop rate per act; cost: compute, people and **Slowdown** (% of the deployment's useful work lost). | % stopped; % slowdown | Q2, Q5 | SAFETY › Safeguards |
| 8 | **Method** | A training-time fix you own and tick in the run plan: data filter, constitution, inoculation, honesty / anti-scheming training, environment fixes, and the flagged "train against an instrument". Output: the predicted change to the trained model's beliefs, as far as your instruments can see. | predicted change, points of the belief | Q5 | TRAINING (picked); SAFETY lists owned ones |
| 9 | **Incident** | A harmful act you observed: caught by a safeguard, reported by a customer, or found by a case. Severity S1–S5, apparent cause, reporting deadline, status. | count, severity | Q2 (feedback) | SAFETY › Incidents |
| 10 | **Case** | A time-boxed investigation of one question: a trait in a model, an incident, an instrument disagreement, a suspected foothold. Output: a verdict and evidence that narrows beliefs. | engineer-weeks; verdict | Q4 | SAFETY › Incidents & cases |
| 11 | **Foothold** | A hidden asset a model gained by an unstopped covert act: backdoor, hidden compute, steered successor, corrupted instrument, escaped copy. Suspected → located → removed. Its size is shown as the points it adds to Loss-of-control risk. | count; points of risk | Q2 | SAFETY › Risks |
| 12 | **Loss-of-control risk** | The headline. Your believed chance that a model you run could act against you with nothing able to stop it. From the "act against the lab" row, its stop rate and your footholds, integrated over your belief ranges and the published range of what is survivable. | % with range | Q2 | Top strip; SAFETY header |

Two policy objects carry the automation and are named, but are not quantities: the **Safety framework** (§3.8) and
the **Safety work package** (AI doing safety work, §5).

### 2.3 Merged and killed

| Today (inventory) | Becomes | Why |
|---|---|---|
| Coverage (tool of trait; monitor of passes; AI of work) G2 | Tool coverage → a trait the instrument cannot read has Reliability 0 for it; monitor coverage → **watched share**, a field of a monitor safeguard; AI coverage → capability-side AI share | three meanings, three homes |
| Catch (monitor catch rate; "your tools catch it"; caught acts) M3, B6, D2 | **Stop rate** (safeguards), **Reliability** (instruments), "caught" (incident status) | |
| Oversight ×4 (effOversight, actOversight, rdOversight, "R&D oversight") F2, D1, M10 | **Stop rate** per act. "Oversight" is reserved for the political Oversight committee | one per act, one formula |
| Containment / block (T11) | Restrictions → **Chances**; blocking safeguards → **Stop rate** | it had no home |
| Control: believed gauge, layer, band, tiers (F1, M7, G2) | Gauge and band → gone (the headline replaces them); layer → the **control protocol** safeguard; tiers → "autonomy level" on products/agents | four meanings |
| Clarity (belief; case stock; family mean) SAF-20, B2, C3 | Belief **range**; case **progress** | |
| Strength (eleven variants) SAF-19, T4 | **Reliability** (instruments), **Stop rate** (safeguards), **expected effect** (methods) | |
| Understanding U, validated to, seen to, likely range, margin, BLIND/AHEAD, detection grid (U1–U7, T6) | **Sight limit** (one level, one range); the detection grid becomes the drill-down of Sight limit | four level readouts for one question |
| Unseen ×3 (U3, U10, B3) | **Unknown** = belief range > 30 points | one definition |
| Misalignment index, "danger line 0.40" (B7) | The **Would try** of the "act against the lab" row (it *is* the engine's Mis, shown once); 0.40 becomes the centre of the published survivability range used only inside Loss-of-control risk | 0.40 was applied to two different quantities |
| Danger acts/yr, D/C/O bars (D1, D2) | The **Harmful acts** table (same formula, now on SAFETY, feeding the headline) | it fed nothing |
| Catastrophe risk own-model row (D3) | **Loss-of-control risk** (+ the misuse-catastrophe acts' unstopped rate). The RISK screen's world view reuses this number for your row | it ignored control and footholds |
| Red flags (B11), E17 trigger | A **framework rule** ("hidden-goal belief upper bound above x → hold frontier runs and open a case") | invisible threshold |
| Health (R2), dead end (R7), "serious staffing" (R9) | RESEARCH's **chance it works** (a true posterior on works/doesn't, SAF-15 fix); dead end = a failed project, no latch | |
| Line / agenda / follow-up / node / finding / result / technique / tool / detector / method (SAF-09, G1) | RESEARCH: line, project, result. SAFETY: instrument, safeguard, method | |
| Goodhart G, mask (T8) | Reliability reason "trained against on V5" | |
| Training pressure ω, successor pull ω, edge w̄, grades (P5, P7, B5) | TRAINING shows "this run pushes" per family; successor steering is an **act** in the table; the trait graph becomes a Codex / TRAINING drill-down | ω meant two things; the graph had no verbs |
| Disposition est^1.5 (D1) | **Would try** | |
| Deferral, human review, gap above humans, control tax (M7–M9) | Settings of the control-protocol and human-review safeguards; cost shown as **Slowdown** | |
| Monitor vs agentMonitor vs runtimeMonitoring (G1) | One **monitor** safeguard; its logs are the **real-use logs** instrument | three jobs, now two named outputs |
| Five foothold units (F3) | Points of Loss-of-control risk, with a kind-specific detail line in the tooltip | |
| Trusted to AI / work AI does / automateSafety / safetyAgents (O3, A1, G1) | The **Safety work package** (one home, LAB) and "AI share" on each job | |

### 2.4 The chain and the headline

```
 Evidence ──► Beliefs (Q1) ──► Would try ┐
 MODELS measured level ─────► Able to    ├─► Unstopped per year, per act (Q2) ──► Unstopped harm / yr (companion)
 Deployment (copies, access) ► Chances   │
 Safeguards ───────────────► Stop rate  ┘
                                   │
   "Act against the lab" row ──────┴──► exposure = Would try × (1 − Stop rate) × (1 + footholds)
                                              │
            published survivability range ────┴──► LOSS-OF-CONTROL RISK = P(exposure > what the world tolerates)
```

- **Acts (data already exists: data/v2/danger.ts DANGER_ACTS, COVERT_ACTS; exfiltration; misuse).** Three groups the
  player can read:
  - *Misbehaviour* (customers and staff see it): tells people what they want to hear · games tests and graders ·
    optimises the wrong target · hides its mistakes · overreaches (out-of-scope access).
  - *Against the lab* (covert, mostly internal): sabotages research (capability and safety) · steers research toward
    its own ends · writes itself into the successor · plants a backdoor · reserves hidden compute · copies cover for
    each other · **acts against the lab** (the composite row: the engine's Mis, the takeover act) · copies itself out.
  - *Misuse by people*: helps with bio · helps with cyber.
- **Unstopped per year** = Would try × Able to × Chances × (1 − Stop rate) — the existing danger formula. Unstopped
  misbehaviour becomes incidents (some caught, some not); unstopped covert acts become footholds.
- **Loss-of-control risk** is the believed odds of the engine's own loss test (safety/control.ts: exposure
  `E = Mis·(1 − O_eff)·(1 + F)` against `θ_w = doomThreshold + ε_w`). The player's version uses the belief
  distribution of Mis, the believed stop rate, known and suspected footholds (plus an "unfound footholds" allowance
  from unstopped covert acts the table expects), and the published prior on θ. Consequences:
  - wide beliefs raise the risk when the mean sits below the line, so **ignorance shows as risk** (fixes U1's "cutting
    research does not lower believed U");
  - a located backdoor, a better monitor or a control protocol moves the headline (fixes D3, D4);
  - it is per model; the lab headline is the highest over the models you run (internal fleets and products), one rule
    for every readout (fixes B10's four model choices).
  - The tooltip states when the risk is live: the engine checks it when a model reaches the point where it could act
    on it (its lab's ASI, or an escaped copy once the frontier is at Superhuman AI researcher). Before that the
    number is "if it could act now", which is what a framework should gate on.
- **Unstopped harm per year** is the sum of the table weighted by severity; it predicts incidents, so each incident card
  links to the act row that predicted it (fixes I1/D1).

---

## 3. Owned things and verbs

Format per item: what the player owns or does · cost · what it buys · how the result is seen · fate of today's items.

### 3.1 Safety research (lives in RESEARCH's shared portfolio)

- **Owns / does.** Safety lines (the 18 agendas as data; see open decision OD-4 on how many are shown) with projects in
  the shared portfolio: priority rank + teams wanted, auto-assigned like capability (SYNTHESIS R, A). A project asks one
  question and ends in a result or a failure (DD-15 a, kept). Each line also has a standing "open study" project whose
  outcomes are discoveries (new failure modes), negative results and spillovers.
- **Cost.** Safety scientists (ideas), safety research engineers and safety compute (experiments), access to frontier
  checkpoints, time.
- **Buys.** A new or better **instrument**, **safeguard** or **method** (a typed effect: reliability by trait and
  instrument kind; stop rate by act; method effect by trait), or a **discovery** (a failure mode becomes nameable and
  investigable; past incidents relabelled).
- **Seen.** RESEARCH row: stage track, ETA, "chance it works" (true posterior, SAF-15), "produces: probe for
  fakes-alignment, internals" and "expected vs observed results per year" (SAF-26). A finished result posts one line
  saying exactly what changed ("Deception probe v2: reliability on scheming 40% → 55% (extrapolated to V5; validate
  to confirm)").
- **Fate.** R1, R3, R4, R9, R10, R11 → MERGE into the RESEARCH portfolio (SAF-02, -03, -18, -24). R2 → CHANGE (true
  posterior). R5 → CHANGE (each result says what it changed). R6, O1 → CHANGE (§3.9). R7 latch → GO (SAF-14). R8 → keep
  as RESEARCH's idle-team flag; auto-assign never staffs unqueued lines (SAF-23). SAF-01 candidate pool → GO.
  SAF-V02 unreachable nodes → end as failure. Staffing switches nothing (SAF-04): GO.

### 3.2 Instruments (see)

- **Owns.** Items such as *Behavioural test suite v3*, *Honeypot set*, *Reasoning monitor*, *Deception probe v2*,
  *Internals verbaliser*, *Real-use logs* (free with any monitor). Each has a kind, the traits it reads, and a version.
- **Validation (replaces tool upkeep and the validation lead).** To trust an instrument on a model you **validate** it:
  plant known behaviour in a copy of that model (a model organism) and count how often the instrument finds it — the
  real practice of sleeper-agent probes and auditing games [S: research/06 §2.9, research/20 F6]. Result: "found 7 of
  10 planted" → Reliability 70% (range from the sample). Internals instruments must also be **ported** (probes and SAEs
  are trained per model). Cost: safety research engineer-weeks and compute that scale with the model's size [R: cost
  anchors; research/20 §G gives eval costs, not organism costs]. A standing policy validates every instrument on each
  new frontier model; the player sees the queue and can reorder it (in LAB).
- **How it ages.** True reliability falls with the capability of the model read, by kind, on sourced curves: behavioural
  by eval awareness (`× (1 − 0.8·EA)`, EA growing ~+0.1 per OOM of RL and ×2 after anti-scheming training [S: research/20
  F5]); reasoning reading by CoT controllability and latent reasoning [S: research/14 §1.0 #3]; internals by obfuscation
  when trained against [S: research/14 §1.0 #4]; oversight-style checks by the overseer gap (Engels) [S: research/20 F4].
  Validation does **not** raise true reliability (it measures it); only research (a new version) raises it. Porting is
  what keeps an internals instrument working at all on a new model.
- **Hidden truth kept.** Validation measures recall on *planted* behaviour; natural hidden traits may be harder. A
  hidden per-world "organism realism" factor scales natural recall relative to planted recall [R: GDM "Difficulties with
  evaluating a deception detector" (arXiv 2511.22662, research/06 §2.9); sleeper-agent probes were organisms only].
  The tooltip says so in one sentence.
- **Where instruments run.** In pre-release evaluation (framework policy), continuously inside monitors (real-use
  logs), and in cases. Each run produces evidence on the beliefs of the model read.
- **Seen.** SAFETY › Instruments: one row per instrument × the selected model: reliability with range, "validated on
  V5 (human-run)" or "extrapolated from V4", reasons for loss, last disagreement.
- **Fate.** T1 → CHANGE (detect tools become this list; contain and fix tools move to 3.3 and 3.4). T2 On/Off → GO (no
  cost, no reason; SAF-V01). T3 → GO (no "detector" changes training: T-HONEY, T-NOISE, T-LOCK, T-TMON edge effects move
  to the safeguard or method that really causes them, e.g. comms lockdown is a safeguard that also cuts the collusion
  edge). T4 → CHANGE (reliability). T5 upkeep card → GO, replaced by validation/port jobs (SAF-10, -11, -12, -V01). T6,
  T7 → MERGE into sight limit and the instrument row. T8 → CHANGE (reason on reliability). T9 → CHANGE (§4.3). T12
  Codex card → CHANGE (shows the data fields, SAF-22). U8 → GO. U11 → KEEP, shown (§3.4).

### 3.3 Safeguards (stop)

One kind of owned item per deployment (product or internal agent package). Each lists its **stop rate per act**, its
**Slowdown**, its compute and people cost.

- **Monitor (one formula for products and internal agents).**
  `stop rate_k = watched share × flag rate_k × action rate`, where
  - *watched share* = the share of the deployment's actions the monitor reads (compute ∝ watched tokens × the watcher's
    cost ratio [S: research/20 F4 control tax]);
  - *flag rate_k* = the reliability of the instrument the monitor uses (reasoning reading or a probe) on the watched
    model for act k, scaled by the watcher's capability gap (Engels-style; ~0.5 at gap 0, 0.1–0.5 at a 400-Elo gap
    [S: research/20 F4]); if the watcher is the same lineage and colludes, × (1 − collusion) [R: anchor on Greenblatt's
    untrusted-monitoring results with collusion-busting; the ×0.6 today is D];
  - *action rate* = the share of flags acted on in time: blocked, deferred, or audited by humans within the audit budget
    (Greenblatt's 2% human audit) [S: research/20 F4].
  - Its logs are the **real-use logs** instrument (evidence on beliefs; symptoms of footholds). Two outputs, one formula
    (fixes M3, M5, M6).
- **Control protocol** (trusted monitoring with deferral / resampling / trusted editing): raises action rate on flagged
  actions; Slowdown from the Greenblatt table (defer 10% → ~7% usefulness lost, safety 62% → 83%) and Ctrl-Z
  [S: research/20 F4]. Replaces the 5% flat tax (M7, M8).
- **Human review**: a share of actions humans approve; costs staff; stops acts whose capability is below the reviewers'.
  Replaces M9's verb-less "gap above humans".
- **Restrictions** (no internet, no code execution, no weights access, scoped context): cut **Chances**, cost usefulness
  (a product's revenue; an agent package's work). Two-way: can be lifted (fixes I7's one-way restrict).
- **Comms lockdown** (AI 2027 Slowdown: lock the shared memory bank): cuts Chances for collusion and successor steering;
  Slowdown [D].
- **Weight security** (LAB/COMPUTE home): the stop rate of "copies itself out"; shown here as a link.
- **Product safeguards** (classifiers, KYC): stop rate on misuse acts.
- **Defaults.** Each deployment type gets a default package from the framework (§3.8). The default internal research
  package no longer uses a self-monitor (M4): the default watcher is the strongest model the framework marks as trusted
  (OD-6).
- **Seen.** SAFETY › Safeguards: per deployment, the safeguards and their stop rate per act; the act table shows which
  safeguard supplies each stop rate.
- **Fate.** M1, M2, M6 → MERGE (one monitor item, one budget: its compute is part of the deployment's compute, listed in
  LAB). M3 → CHANGE (the number shown is the number used). M4 → CHANGE (collusion shown as a factor; default fixed). M5 →
  CHANGE (named output). M7, M8, M9, M10, M11 → MERGE into the protocol, review and lockdown items. T11 → GO as a
  concept (containment = restrictions + blocking). F2 → GO. I10 → CHANGE (removing a safeguard is a normal edit).

### 3.4 Methods (fix in training)

- **Owns.** Methods from research and from incident fixes: *hazard data filter*, *constitution*, *inoculation*,
  *honesty / confession training*, *anti-scheming training*, *weak-to-strong supervision*, *environment fixes* (a fixed
  grader, reward model or environment, created by an incident response and reused by every later run that uses that
  environment family, floor ×0.2 [D: V2-SPEC 3.5.9]), and the flagged *train against an instrument*.
- **Picked.** In TRAINING's run plan as ticked options with their cost (compute, weeks, capability change). A standing
  policy "use all known methods" is on by default and its cost line is shown (DD-16 a kept; SAF-05 dead wiring filled).
- **Effect.** Each method's effect on trait growth or removal scales with its own measured efficacy from research
  (SAF-07: `mult = 1 − (1 − base)·efficacy·decay`), anchored where sources exist: inoculation 75–90% of emergent
  misalignment; anti-scheming covert actions 13% → 0.4% with EA ×2; chat RLHF fixes chat contexts only [S: research/20
  F2, F5; research/06 §2.3–2.4].
- **"What you can see you can fix" (U11) stays and is shown.** Safety training removes only what its signal can see
  (V2-SPEC 3.5.4 `vis_j`); this is grounded in sleeper agents persisting and RLHF fixing only chat [S: research/20 F6,
  F2]. The run plan's prediction includes it: "removes ~60% of reward hacking your instruments see; what they cannot
  see stays".
- **Train against an instrument** (Retrain against, I5) moves here from the incident menu, with the preview the
  mechanism produces: "belief drops a lot; true change small; this instrument's reliability on the new model drops
  (trained against)". No longer free: it costs a run slot like any method.
- **Seen.** TRAINING run plan: per family, "pushes" (from the run's quantities) and "removes" (from methods), then a
  predicted belief for the new model with range. SAFETY › Model lists which methods each model was trained with.
- **Fate.** T10 → CHANGE (owned, ticked, not staffed). P1 → CHANGE: Standard / Heavy / Minimal stay as the safety
  training amount; Inoculation becomes its own method (no hidden boolean); Heavy no longer hides anti-scheming and the
  audit (P10 → the audit becomes a case type, §3.6). P2 (Rewarded for) → keep; T-SPEC folds into it (SAF-06). P4 → keep;
  T-FILTER folds into it. P3, P9, O2 → keep. P5, P8, P11 → keep in TRAINING. P6 → CHANGE (prediction = mechanism on a
  copy, incl. healing and detection-gated removal). P7 → MERGE (successor steering act + Blueprint inheritance line). I4
  patch → CHANGE (environment fix, also creatable from TRAINING › Environments). I6 targeted training → MERGE into
  methods (one anti-scheming, not three). AG18 "healing while staffed" → the safety-training method's own effect
  (SAF-04c). T-HARDEN, T-UNDO, F13 → wire or delete (SAF-06).

### 3.5 Evaluations

- Two kinds, both instruments' runs, both automatic under the framework:
  - **Dangerous-capability evals** feed **Able to** through MODELS' measured domain levels (DD-08 a: fitted from
    benchmarks, sandbagging can fool it).
  - **Alignment evals** (behavioural tests, honeypots) produce evidence on beliefs. Their results are finally shown:
    "Propensity: games tests 12% (range 6–20%) in tests; real-use logs 19%" (fixes E2).
- **External evaluators** (independent, government) add elicitation and a reliability bonus on behavioural tests; they
  need ≥ 4 weeks of access, shorter access widens ranges [S: research/20 §G]. Each states what it adds (E4).
- **Cost.** Safety research engineers (not capability engineers, fixes S4) and evaluation compute.
- **Fate.** E1 gate → MERGE into the framework (its fake previews go). E2 → CHANGE (shown). E3, E5 → keep on MODELS,
  with the safety part's value shown. E4 → CHANGE. E6 → CHANGE (clearance = framework rule).

### 3.6 Cases (learn more, on purpose)

- **Does.** Open a case on a question (trait × model, incident, disagreement, suspected foothold). The case picks the
  instruments it uses (default: every owned instrument that reads the trait, preferring independent kinds), and is a job
  in the safety engineers' needs list. Alignment audits (today hidden in Heavy, P10) become a case type the framework
  can require before release.
- **Cost.** Engineer-weeks and compute, both previewed; AI share if the Safety work package helps.
- **Buys.** Evidence: the preview shows the expected range after ("scheming in V5: 4–30% → about 6–15%, if your
  instruments are as reliable as believed"). Outcome odds come from the combined reliability of the instruments used,
  with the independence rule (instruments on the same world assumption combine at ρ = 0.5; two probes ≈ 1.3 tools
  [D: research/14 §1.6 B]) and the auditing-game precedent (black-box only rarely finds hidden objectives) [S].
- **Verdicts** (confirmed / benign / inconclusive / false alarm / discovery) each say what changed. A verdict reached
  with AI help carries "AI share 40%, spot-checked 10%" (C6 visible).
- **Fate.** C1, C2 → CHANGE (one "Open case" verb; other screens link to it with the question pre-filled; size from the
  preview, not fixed 15). C3 → "progress"; the made-up rate (SAF-25) → job duration from engineer-weeks. C4, C5 →
  CHANGE (say what changed). C6 → shown.

### 3.7 Incidents and responses (cause-aware)

- **Flow.** Incident → (framework: auto-open a case for S3+) → verdict names a cause → responses offered **for that
  cause**:
  | Cause found | Responses offered (each previewed by the mechanism) |
  |---|---|
  | A training signal (an exploitable environment, grader, reward model) | Environment fix (a method reused by later runs) |
  | A trait in this model | Add a method to the next run · roll back · restrict this deployment · add a safeguard |
  | Misuse by a user | Tighten product safeguards (classifier, KYC) |
  | A foothold | Remove it (job: engineers, agent downtime shown on LAB) |
  | Unknown | Investigate further; contain meanwhile (restrict, safeguard) |
- **Disclosure is a separate decision** with its own policy: *legal minimum* (default: report what SB 53 / RAISE require,
  on time), *full*, *none*. Fixing never closes the disclosure question; "covered up" happens only if you choose not to
  report something that must be reported, and the card says so before you choose (fixes I3/I13, V2).
- **Effects take time and show where they land.** A fix's preview says where its effect will appear (the next run's
  predicted beliefs, or the deployment's stop rate from date X); nothing claims an instant change the player cannot see.
- **Fate.** I1, I2, I12 → keep. I3 → CHANGE (cause-aware). I5 → MOVE to methods. I6 → MERGE into methods. I7 →
  two-way. I8 → keep (one entry point on MODELS, linked). I9 → CHANGE (disclosure policy + per-incident override). I11
  → keep; the card notes that the apparent cause is a guess until a case confirms it. I13 → CHANGE (only via an explicit
  choice). V2 "Fix quietly" → GO.

### 3.8 The Safety framework (automation that explains itself)

The lab's own frontier safety framework, as an owned, editable policy [S: RSP / Preparedness / FSF, research/06 §2.11].
- **Rules.** Thresholds on measured capability (bio, cyber, AI R&D, autonomy) and on beliefs (upper bound of "would
  try: act against the lab"), each with **required safeguards** and **required evidence** (e.g. "internal deployment of
  a model at AI-R&D threshold: control protocol on, instruments validated on it, alignment audit case passed").
- **Actions it takes.** Holds a release or an internal deployment until requirements are met; holds frontier training
  (the standing **pause** verb, today only in E17, V1); opens cases; queues validations. Every hold shows the rule
  that triggered it and the one-click override, with its cost if published.
- **Publishing it** is a commitment (credibility, scrutiny; breaking it later is visible). Pledges (monitorability, O2)
  become framework rules.
- **Fate.** E1 → MERGE. B11, V1 triggers → rules. O2, O5 → MERGE (commitments). The E17 event remains only as the story
  beat when a rule first fires on hidden-goal evidence (events are rare).

### 3.9 Publishing results

- RESEARCH's policy (none / selective / all) with only effects the engine applies, previewed in their own currencies:
  credibility, safety-talent pull, and "rivals gain this instrument / method" (a named owned thing in rivals' aggregate,
  not "+0.02 alignment"). Spillover results show their capability leak (DD-18 rivals in the player's units).
- **Fate.** R6, O1 → CHANGE (real effects only).

### 3.10 AI doing safety work

- The **Safety work package** (LAB): which model does it, compute, and a **human spot-check share** (none / 2% / 10%:
  the real control lever on sabotage, Greenblatt's audit budget [S: research/20 F4]). Each job shows its AI share.
  Sabotage is a hidden property of the AI share of work (kept, A2); its symptoms are readable: expected vs observed
  results per year, spot-check disagreements, and validations that pass when AI-run but fail when human-run.
- **Fate.** O3, O4, A1 → MERGE (one home). A2 → keep, symptoms shown. A3 harness → a built result with upkeep (SAF-04d).
  A4 level gate → GO (SAF-17).

---

## 4. Information: what each screen shows, and how the player learns a tool is wrong

### 4.1 Per question

| Q | Primary readout (first glance) | Drill-down (hover / click) | Reliability shown as |
|---|---|---|---|
| Q1 Beliefs | Per model, four family bars (best guess + range), "Unknown" chip when range > 30 pts | Traits; each trait's evidence list (instrument, date, model, reading, that instrument's reliability then) | the range; the evidence count by instrument kind |
| Q2 Risks | **Loss-of-control risk** (headline, range) and **Unstopped harm/yr**; act table sorted by unstopped | Per act: the four factors, each with its source and "what lowers it" (before → after, computed) | each factor's range; Stop rate states its watcher, flag rate and action rate |
| Q3 Instruments | Instrument × selected model: reliability with range, validated-on, warning chips | Reasons for loss, validation history (planted found / planted), disagreements | "validated on V5, human-run" vs "extrapolated" (dashed) |
| Q4 Learn | Open-case and validate buttons with previews; case progress | Outcome odds; instruments used; AI share | the preview's "if instruments are as reliable as believed" |
| Q5 Fix | Response list per incident cause; safeguard edits with stop-rate and slowdown deltas; TRAINING run prediction | Mechanism trace of each preview | ranges on every predicted belief |
| Q6 Keeping up | **Sight limit vs frontier level** (and vs the planned run); safety jobs waiting; research ETAs | The detection grid (trait × level); which instrument fades first; validation queue | sight limit range |

One rule for *which model*: every SAFETY readout is for the model in the model picker, default "your riskiest running
model"; lab-level numbers are the maximum over running models, labelled with which one.

One colour scale for beliefs and risks (four steps), used everywhere (fixes B3's four scales).

### 4.2 What the player is always told (without leaking truth)

- What each instrument reads, its believed reliability on this model, and whether that is measured or extrapolated.
- The prior they act on (published survivability range; organism-vs-natural caveat) as one sentence each.
- For every verb: the preview computed by the mechanism on a copy (theme V), in its own unit.
- Never: true traits, true reliability, the world's tolerance, hidden footholds, whether a result was sabotaged.

### 4.3 How the player learns an instrument is wrong

Five sourced channels, all of them observations the player can read:

1. **Validation** (planted behaviour): a false (sabotaged) instrument fails to find planted behaviour when humans run
   the validation; a degraded one finds less. AI-run validation can itself be corrupted, so the row says who ran it.
   [S: auditing games, research/06 §2.9]
2. **Disagreement between instrument kinds**: when two independent kinds read the same trait outside each other's
   ranges, a "disagreement" chip appears and the framework can open a case. This replaces the side-effect-only
   cross-checks (T9) [S: research/14 §1.0 #2 independence; §1.6 B].
3. **Test-vs-real gap**: behavioural tests and real-use logs read the same behaviour in different settings; a model that
   behaves better in tests than in use shows a gap, which is how eval awareness becomes visible (Opus 4 55.1% vs 6.5%;
   26% vs <1%) [S: research/05 §1.7]. The behavioural instrument's reliability carries "model notices tests" with the
   eval-awareness belief.
4. **Trained against**: the player chose it, so the instrument says "trained against on V5" and its extrapolated
   reliability on later models in that lineage drops (Baker; Bailey) [S].
5. **Results that do not add up**: expected vs observed results per year on lines and spot-check disagreements on AI
   work expose sabotage of safety research (A2, SAF-26).

---

## 5. Resource flows: one allocator, consistent with capability (theme A)

| Resource | Safety uses | Allocation | Home | Visible |
|---|---|---|---|---|
| Safety scientists | Safety research projects | RESEARCH priority + teams wanted, the same planner as capability; idle teams stay idle and are flagged | RESEARCH | yes |
| Safety research engineers | One ordered needs list: **cases → validations & ports of the new frontier model → pre-release safety evals → environment fixes → foothold removal → research experiments (RESEARCH order)**. Each need has a real demand that falls to zero; leftover = idle. Player reorders. | LAB needs list (replaces the fixed priority and 50% cap, SAF-03; removal no longer labelled "patches", T5) | LAB | a bar per need + idle |
| Safety compute | Research experiments, validations & ports, cases, evals | One line "Safety" in LAB's flat compute allocation with its sub-uses shown (fixes S3: breakdown and idle visible) | LAB | yes |
| Safeguard compute | Monitor inference, control-protocol overhead | Billed to the deployment it protects (watched share × watched tokens × watcher cost ratio); summed as "Safeguards" in LAB's allocation. Raising a monitor no longer silently starves research (M1) | SAFETY sets it; LAB shows it | yes |
| Staff for human review / audits | Human review safeguard, audit budget, spot-checks | Part of the safety engineers' needs list | LAB | yes |
| AI labour | Safety work package (model, compute, spot-check share) | LAB AI staff packages (SYNTHESIS A) | LAB | AI share per job |
| Slowdown | Control protocol, restrictions, lockdown | Applied to the protected deployment's work or revenue | SAFETY | per safeguard and total |
| Cash | Hiring, compute, safeguards | — | LAB | **Safety spend $/yr** total, with lines (fixes S5) |
| Run cost | Methods in runs | TRAINING run plan cost lines | TRAINING | yes |

SAFETY shows a **Capacity** strip that reads, never sets: jobs waiting by need, weeks to clear, idle, safety spend,
with links to LAB. One home per datum.

---

## 6. Mechanisms that need sourcing or rethinking

| # | Mechanism (inventory / SAF) | What it does today | What the sources say | Recommendation |
|---|---|---|---|---|
| 1 | **Blind gap speeds trait growth** (U9; V2-SPEC 3.5.4 `gap = 1 + 0.4·min(2.5, L − U_true)`) | Multiplies every run's trait growth by up to 2 from the *true* gap; invisible | No source; [D]. The sourced reasons blind labs drift are already modelled: safety training removes only what its signal sees (sleeper agents; chat-only RLHF fixes, research/20 F2, F6) and unseen acts go unstopped. A real third channel exists: **undetected reward hacks get reinforced** (Baker 2025; METR o3 30% hacking where scorers are exploitable; Gao over-optimisation, research/20 F1) | **Delete.** Optionally add [R] "undetected hacking is reinforced": an RL run's hack rate on a family rises with the share of hacks its graders and monitors miss; detected hacks produce environment fixes. Re-run S4/S5 and search for the missing mechanism before touching constants (Emergent outcomes). |
| 2 | **Tool upkeep as half-point drift** (T5; SAF-11, -12; V01) | A leftover engineer pool raises tools' half-points continuously; 15 / 40 / 90-day constants | Probes and SAEs are trained per model; detectors are validated on model organisms (research/06 §2.6, §2.9; MODEL-V3 §11.5) | **Replace** with discrete port + validate jobs per (instrument, new model); true decay on sourced curves per kind; delete M½ units, UPKEEP_*, LINE_MULT_MAX. [R] cost per validation. |
| 3 | **Validation lead** (U8; SAF-10) | Raises believed U only, from the same engineer pool | None | **Delete.** Believed reliability comes from validation evidence. |
| 4 | **Line health heuristic** (R2; SAF-15, -16) | Beta updated by mixed result types; also scales tools already owned | Efficacy is a world property learned by trying (research/14 §1.0 #1) | **Replace** with a Beta on works/doesn't only (DD-15 a); say in the tooltip that a line's efficacy also sets its instruments' reliability (shown via validation). |
| 5 | **Catastrophe risk ignores control** (D3, D4) | Own row = P(first) × (0.7·σ((mis − 0.4)/0.06) + 0.3·margin) | The engine's own loss test is exposure-based (safety/control.ts) | **Replace** the own row with Loss-of-control risk (believed exposure test). Driver shares computed, not constants; rogue-row levers wired. |
| 6 | **Belief drift with time** (B9) | sd +0.01/week since the last observation; +0.05/day for stream versions | Evidence is about a checkpoint; a frozen model does not change | **Replace**: no drift on a frozen model. A new model starts from its parent's beliefs, widened by the run's predicted change; stream updates widen by their training. Monitors keep beliefs fresh by producing evidence, not by stopping decay. |
| 7 | **Case clarity rate** (C3; SAF-25) | `g·√(fte·m/15)·min(1.5, (share/0.05)^0.2)` | Auditing-game outcomes depend on the instruments used (research/06 §2.9) | **Replace**: case = job of engineer-weeks; outcome odds from the instruments' combined reliability (ρ = 0.5 rule [D]). |
| 8 | **Fix methods as flat multipliers** (T10; SAF-07) | ×0.7, ×0.1 etc. regardless of efficacy | Inoculation 75–90%; anti-scheming 13% → 0.4%, EA ×2 (research/20 F2, F5) | **Scale** by the method's efficacy (RD-S03); anchor base values on the sources. |
| 9 | **Monitor collusion ×0.6** (M4) and catch formula | Flat factor; displayed catch ≠ used catch | Greenblatt untrusted monitoring with collusion-busting 79–98% safe; Engels gap curve; Terekhov monitor AUC 0.92–0.96 (research/20 F4) | **Rebuild** as §3.3's one formula; [R] collusion factor from the untrusted-monitoring results. |
| 10 | **Control tax 5% flat** (M7) | One tax for every protocol | Greenblatt protocol table; Ctrl-Z 5% cost (research/20 F4) | **Replace** with protocol settings mapped to the table. |
| 11 | **Response effects instant on truth** (I3) | Apply changes hidden traits at once; previews show durations that are not | — | **Change** to jobs with durations; effects land on next run / deployment and are previewed there. |
| 12 | **Successor pull** κ = 0.4·(1 − 1/M) (P7) [D] | Hidden pull on the next model | AI 2027 Agent-4 → Agent-5 (narrative) | **Keep tagged [D]**, but route it through the "writes itself into the successor" act so its stop rate (monitors on R&D work, lockdown) is visible and controllable. |
| 13 | **Threshold 0.4 used twice** (B7, F1) | Misalignment danger line and exposure loss line | — | **One** survivability prior used only inside Loss-of-control risk. |
| 14 | **Dead-end latch** (R7; SAF-14) | ×0.5 line speed forever | — | **Delete.** |
| 15 | **Organism realism** (new, §3.2) | — | Organism-only validation of probes; GDM on evaluating deception detectors | **[R]** before build: a hidden per-world factor or none (OD-7). |
| 16 | **Eval awareness growth** (B1, E2) | Present | κ_RL ≈ +0.1 / OOM of RL; ×2 after anti-scheming (research/20 F5) | **Keep**; make it visible via the test-vs-real gap. |
| 17 | **Validation and organism costs** (new) | — | research/20 §G covers eval suites only | **[R]** primary sources on model-organism / auditing-game effort (Anthropic auditing paper, UK AISI game). |

---

## 7. UI sketch: the SAFETY screen

Top strip (permanent): `LOSS-OF-CONTROL RISK 9% (3–24%)` · `Sight L 9.1 | Frontier L 9.6` (the race, small).
SAFETY has five tabs, each answering one or two questions. Research projects are in RESEARCH; methods are picked in
TRAINING; allocations are set in LAB.

```
SAFETY                                    Model: [ V5 (internal research agents) ▾ ]   riskiest running model
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Loss-of-control risk 9% (3–24%)   Unstopped harm 14 / yr (2 serious)   Sight L 9.1 vs V5 L 9.6 (partly blind) │
│ Framework: holding V6 release — "AI-R&D threshold needs instruments validated on V6"  [why] [override]     │
├── Risks ── Model ── Instruments ── Safeguards ── Incidents & cases ──────────────────────────────────────────┤
│ RISKS (Q2)                       Would try   Able to   Chances/yr   Stop rate   Unstopped/yr               │
│  Against the lab                                                                                            │
│   Acts against the lab          4% (1–15)    —          internal     71%         → risk 9%   ▸            │
│   Sabotages research            6% (2–20)    high       38k          55%         2.1  ▲                    │
│   Writes itself into successor  3% (1–12)    high       per run      40%         0.6                       │
│   Plants a backdoor             2% (0–9)     medium     12k          68%         0.3                       │
│  Misbehaviour                                                                                               │
│   Games tests and graders       18% (10–30)  —          410k         35%         8.0  (incidents)          │
│   ...                                                                                                       │
│  Misuse by people  ...                                                                                      │
│  Footholds: 1 suspected (unexplained compute use)  +2 pts of risk  [Open case]                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 hover a factor → its source and "what lowers it": e.g. Stop rate 55% = watched 40% × flag 70% × acted 95%
                  watcher V3 (trusted) · gap 1.2 levels · [raise watched share to 60%: 55% → 72%, +3% compute]
```

- **Model (Q1).** Four family bars with ranges, "Unknown" chips, the methods it was trained with, its parent. Click a
  family → traits → evidence list. Test-vs-real gap shown on behavioural traits.
- **Instruments (Q3, Q6).** Rows: instrument · reads · reliability on the selected model (solid = validated, dashed =
  extrapolated) · validated by · warnings (notices tests / trained against / not ported / disagreement). Header: Sight
  limit with range and the detection grid as its drill-down. Buttons: Validate on V6 (preview: weeks, compute, expected
  range). Validation queue link → LAB.
- **Safeguards (Q2, Q5).** Per deployment: list of safeguards with stop rate per act, slowdown, compute, staff; edit in
  place with computed before → after on the act table and the headline. Framework rules that require them are marked.
- **Incidents & cases (Q4, Q5).** Incident cards (severity, apparent cause, reporting deadline, link to its act row);
  case cards (question, instruments, progress, AI share, verdict and what changed); cause-aware responses after a
  verdict; disclosure status per incident under the disclosure policy.
- **Capacity strip** (all tabs, bottom): safety jobs waiting by need, idle, safety spend $/yr → LAB.
- **Gone from SAFETY:** Research lines tab (→ RESEARCH), Trait graph tab (→ TRAINING drill-down / Codex), Policies tab
  (→ framework editor, publish policy in RESEARCH, disclosure policy in Incidents), the Control card, the race chart as
  a tab (→ Sight limit drill-down on Instruments).

Good-ui checks: one home per datum (headline in the top strip and the SAFETY header link to one computation); first
glance = headline, unstopped harm, sight limit, the framework's current hold; every term (12 concepts, act names,
instrument kinds) gets a tooltip.

---

## 8. Open decisions and build outline

### 8.1 Open decisions

| # | Decision | Options | Rec. | Consequence |
|---|---|---|---|---|
| OD-1 | Headline set | (a) Loss-of-control risk + Unstopped harm/yr; (b) Loss-of-control risk only; (c) keep the L-vs-U race as the hero | (a), with the sight-limit race small beside it | Top strip changes; the V2-SPEC T1 "dual race" becomes secondary |
| OD-2 | When the headline is live | (a) always shown as "if it could act now", tooltip states when the engine checks it; (b) shown only once a model is near the point it could act | (a) | Early-game risk reads low but nonzero; framework rules can use it from day 1 |
| OD-3 | Delete the blind-gap growth amplifier (§6 #1) | (a) delete; (b) delete and add sourced "undetected hacking reinforced" [R]; (c) keep tagged [D] | (b), in that order | S4/S5 must be re-checked; if divergence shrinks, the search is for the missing sourced channel, not a constant |
| OD-4 | How many safety lines the player sees | (a) all 18; (b) ~10 visible (fold formal/oracle AG04/AG10/AG11; AG12 into a speculative "foundations" line; AG13 into applied interp), data keeps 18; (c) group by output (see / stop / fix / meta) | (b)+(c) | Codex and catalog rows regrouped; DD-15 refit already planned |
| OD-5 | Release control | (a) Safety framework policy (rules → holds, overrides); (b) keep the eval-gate toggle | (a) | E1, E17 trigger, pledges merge; previews must come from the rule engine |
| OD-6 | "Trusted" models for watching | (a) automatic: a model is trusted if its "act against the lab" upper bound is below the framework line or it is below the scheming-capable level, override allowed; (b) player marks models; (c) no concept, collusion only by lineage | (a) | Default monitors stop being self-monitors (M4); bots change |
| OD-7 | Organism realism (validation measures planted, not natural, traits) | (a) hidden per-world factor [R]; (b) none: validation measures natural recall with sampling noise | (a) if research finds a range, else (b) | (a) keeps a sourced reason why validated instruments can still miss |
| OD-8 | Default disclosure policy | (a) legal minimum; (b) full; (c) none | (a) | Cover-ups only by explicit choice |
| OD-9 | Where safety engineers' order is set | (a) LAB needs list; (b) SAFETY | (a) (theme A one allocator) | SAFETY shows a read-only capacity strip |
| OD-10 | Primary grouping on SAFETY | (a) acts (Risks tab first); (b) trait families (Model tab first) | (a): acts are what the framework, safeguards and incidents act on | Families stay as the Model tab's grouping |
| OD-11 | Train against an instrument | (a) a method option with the honest preview; (b) remove entirely | (a) — it is real practice and the trap teaches | The incident menu loses it |

### 8.2 Phased build (engine first, then UI; small single-concern tasks)

Depends on SYNTHESIS Phase 3 (one research engine and allocator: RD-R*, RD-A04/A05) for the research and allocation
parts; the act table and headline can start earlier. Each task: tsc + test:quick + `safety` suite; "deep" adds
test:deep (S4/S5); calibration follows the Emergent-outcomes rule.

| Phase | ID | Task | Depends | Tier |
|---|---|---|---|---|
| S0 cleanup | SR-01 | Delete validation lead, dead-end latch, tool On/Off, staffing switches' UI copy; fix lying previews (E1, O1, O2, I3 durations, V2) | – | safety |
| | SR-02 | Remove the blind-gap amplifier behind a flag; report S4/S5 deltas (decision OD-3) | – | deep |
| S1 one chain | SR-03 | Act table per model from the existing danger formula (all acts incl. covert, exfiltration, misuse) as one engine view | – | safety |
| | SR-04 | Loss-of-control risk = believed exposure test (belief distribution, believed stop rate, footholds, survivability prior); replaces the own-model catastrophe row and the control gauge | SR-03 | safety + deep |
| | SR-05 | One "which model" rule and one colour scale in every safety view | SR-03 | ui |
| S2 beliefs | SR-06 | Beliefs per model with evidence list; no time drift; inheritance widened by predicted run change | – | safety + deep |
| | SR-07 | Alignment-eval rates shown as evidence; test-vs-real gap readout | SR-06 | safety |
| S3 instruments | SR-08 | Instrument items from detect techniques; true reliability by kind on sourced decay curves (one strength definition, RD-S03 part) | SR-06 | safety + deep |
| | SR-09 | Validation and port jobs (planted-behaviour sample → measured reliability); upkeep code and M½ units deleted | SR-08, RD-A04 | safety + deep |
| | SR-10 | Disagreement detection between independent kinds; false-instrument exposure via human-run validation | SR-09 | safety |
| | SR-11 | Sight limit from believed reliability; planned-run readout for TRAINING | SR-08 | safety |
| S4 safeguards | SR-12 | One monitor formula for products and internal packages; logs as an instrument; compute billed to the deployment | SR-03 | safety + serving |
| | SR-13 | Control protocol, human review, restrictions (two-way), lockdown as safeguard items with Greenblatt-mapped slowdown | SR-12 | safety + deep |
| S5 methods | SR-14 | Methods as run options with "use known methods" policy; T-SPEC / T-FILTER / inoculation folded; train-against moved here (RD-S02a) | – | safety + deep |
| | SR-15 | Method effects scaled by efficacy; run prediction = mechanism on a copy incl. detection-gated removal and healing (P6) | SR-14 | safety + deep |
| | SR-16 | Environment fixes as owned method items reused by environment family | SR-14 | safety |
| S6 incidents & cases | SR-17 | Cases as jobs with instrument choice and preview; verdicts say what changed (RD-S05) | SR-08, RD-A04 | safety |
| | SR-18 | Cause-aware responses; disclosure policy separated from fixing | SR-17 | safety |
| S7 framework | SR-19 | Framework rules engine (thresholds, required safeguards and evidence, holds incl. frontier-training pause, overrides) replacing the eval gate and E17 trigger | SR-04, SR-13 | safety + deep |
| | SR-20 | Default safeguard packages and "trusted" rule (OD-6) | SR-19 | safety |
| S8 allocation | SR-21 | Safety needs list in LAB's allocator; safety compute sub-uses; safety spend total; eval staff from safety engineers | RD-A04/A05 | cal + safety |
| | SR-22 | Safety work package with spot-check share; AI share per job; expected vs observed results (RD-S08) | SR-21 | safety |
| S9 calibration | SR-23 | Re-run S4/S5 and safety rates; trace any miss to a sourced mechanism (OD-3 b if needed) | all engine | deep |
| | SR-24 | Research tasks [R]: organism validation cost and realism; collusion factor; undetected-hack reinforcement | – | research |
| S10 UI | SR-25 | Top strip headline + sight limit | SR-04, SR-11 | ui |
| | SR-26 | SAFETY › Risks and Safeguards tabs | SR-13 | ui |
| | SR-27 | SAFETY › Model and Instruments tabs | SR-10 | ui |
| | SR-28 | SAFETY › Incidents & cases; framework editor | SR-19 | ui |
| | SR-29 | TRAINING run-plan method options and prediction; RESEARCH safety rows (chance it works, produces, expected vs observed) | SR-15, RD-UI3 | ui |
| | SR-30 | Glossary: the 12 concepts, act names, instrument kinds; delete obsolete entries (G1–G3) | SR-25..29 | ui + lint-ux |

SYNTHESIS tasks this absorbs or replaces: RD-S01 (kept as is), RD-S02a → SR-14, RD-S02b → SR-12/SR-15/SR-22, RD-S03 →
SR-08/SR-15, RD-S04 → SR-09, RD-S05 → SR-17, RD-S06 (kept), RD-S07 → SR-14, RD-S08 → SR-22, RD-UI7 → SR-25..28.
