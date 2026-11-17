# Shared mockup scenario (all v3 mockups use these numbers)

Start type: **Frontier leader** (Easy). Game date: **12 Mar 2026**, day 254. Speed 2. Player lab models are named
**Atlas**. Rival labs (simulated, fictional): xLab, Gemini Labs, Anthropos, Meridian (US); DeepCent (China).

## L0 top strip (STRUCTURE §5)
- Date 12 Mar 2026 · speed controls
- Capability vs understanding: L 7.3 (Atlas-3.1, measured) vs U 6.9 → 0.4 blind
- Cash $31.2B · runway 7q (tight zone starts < 6q)
- Revenue $14.0B/yr run-rate · 248M weekly users
- Lead over nearest rival: +41 d (xLab), est. ±20 d
- Catastrophe risk 9% (band 4–18%)
- Alerts: 3

## Nav (L1 screens)
Overview · Company · Research · Models · Products · Safety · Compute · Finance · Relations · World · Codex

## Teams (fixed sizes: engineering 150, research engineering 100, science 40)
| Role | Teams | People | AI share of the work | Payroll |
|---|---|---|---|---|
| Engineers | 5 | 750 | 62% | $0.53B/yr |
| Research engineers, capabilities | 12 | 1,200 | 38% | $0.96B/yr |
| Research engineers, safety | 1 | 100 | 38% | $0.07B/yr |
| Scientists | 11 | 440 | 4% | $0.41B/yr |
Science teams by specialty: Pretraining 2 · Post-training 3 · Systems 2 · Alignment 2 · Interpretability 1 · Evals & control 1.
Team qualities: mostly Strong; two Elite (Post-training "Reasoning group", Interpretability "Probe team"); one Solid.
Candidate list (hiring): Engineering team (Strong, $105M/yr, arrives in 6 wk) · Research-eng team (Solid, $80M/yr) ·
Science team, Alignment (Elite, $64M/yr) · Science team, Systems (Strong, $48M/yr).
Morale 71 · safety morale 64 · talent pull +6.

## Research
- Research speed M **1.9×**, compute-bound (experiments). Best lever per $: +10% experiments → +3.1%.
- Know-how: Atlas-3.1 embodies know-how to Jan 2026; **+2.6 months** of know-how not yet trained in.
- Active projects (science teams assigned):
  | Project | Column | Teams | Progress | Odds | ETA |
  |---|---|---|---|---|---|
  | Automated AI research agents | Systems | 2 (Systems ×2, match) | 46% | 75% | 4.5 mo |
  | Continual learning | Post-training | 2 (Post-training) | 21% | 70% | 7 mo |
  | Synthetic data flywheel | Pretraining | 2 (Pretraining) | 63% | 80% | 2 mo |
  | Self-play curricula | Post-training | 1 (Post-training Elite) | 12% | 60% | 9 mo |
  | Honesty & confession training | Alignment | 2 (Alignment) | 55% | line: Mixed | 2.5 mo |
  | Deception probe | Interpretability | 1 (Interp Elite) | 71% | line: Promising | 1 mo |
  | Realistic honeypots | Evals & control | 1 (Evals) | 30% | line: Promising | 3 mo |
- Queued: Anti-scheming training (needs Honesty & confession + Linear probes ✓), Learned research taste (needs
  Automated AI research agents), AI kernels.
- Last result: "Linear probes — works well (strength 0.78)" on 2 Mar. A failed idea: "Test-time training — didn't work
  in this world; retry from 14 Aug 2026 at 30%".

## Models
- Base **Atlas-3**: 2.5e27 FLOP (×1.0 frontier at the time), MoE, code & math data, finished 20 Nov 2025.
- **Atlas-3.1** (post-train, SWE + ML research RL, heavy hardened, visible reasoning, constitution, standard safety):
  internal agent; measured L 7.3; serve cost 0.50; monitorability high.
- **Atlas-3.0**: live in Chat, API, Enterprise; L 7.1. **Atlas-3-mini**: in Chat (free tier) and API; L 6.8, serve 0.13.
- Training compute: 410K H100e (34% of 1.2M online). One run active: post-train Atlas-3.2 (computer-use + long-task
  RL), 58%, ETA 24 d.
- Blueprint being designed: **base Atlas-4**: size ×2 of today's frontier run (6.1e27 FLOP), MoE, native multimodal
  data, quality + hazard filter; wall time 118 d on 60% of the training pool; finishes 8 Jul 2026, **3.9 months of
  know-how behind at finish**; data 1.3× needed (ok); cash $7.4B; restart risk 9% (×0.5 if Fault-tolerant training,
  not unlocked); serving cost 0.71 (vs 0.50 today); engineers: 1.5 team-months of build capacity; predicted L 8.0–8.5
  (after a standard post-train); trait pressure: Power ▲ (long-task RL later), Deception ▲ small (scale).

## Products (all editable while live)
| Product | Model | Customers | Revenue | Share | Best rival | Binding | Price | Safeguards |
|---|---|---|---|---|---|---|---|---|
| Chat | Atlas-3.0 (+ mini on free tier) | 248M weekly users | $5.6B/yr | 58% consumer | Gemini Labs 24% | quality | Standard | Classifiers, KYC 0 |
| API | Atlas-3.0 / mini | 3.1M developers | $4.0B/yr | 36% | Anthropos 29% | capacity | Standard | Classifiers, KYC 1 |
| Enterprise | Atlas-3.0 | 41K orgs; sector packs: Software & IT, Finance, Legal | $3.1B/yr | 31% | Anthropos 27% | quality | Premium | Classifiers, KYC 2 |
| Coding agent | Atlas-3.1 (needs release clearance — evals passed 5 Mar) | 1.2M seats | $1.3B/yr | 34% | xLab 30% | price | Standard | Classifiers |
| Agents | not launched | — | — | — | xLab "Operator" 52% | needs time horizon ≥ 4 h (Atlas-3.1: 2.6 h) | — | — |
Serving compute: 290K H100e, auto-split by demand. Features built: Memory, Deep research, Voice & vision. Feature in
build: Computer use (engineers 1 team, 3 wk left). Unlockable: Sector pack Healthcare ($0.2B, 2 team-weeks).

## Agent packages (STRUCTURE §4.9) — added after review
Every deployment = model + optional monitor + compute. Cost at $13K per H100e-year. Catch rate = share of the watched
model's bad actions the monitor flags (falls with the capability gap).

| Internal use | Budget | Model | Monitor | Compute | Copies × speed | AI share of the work | Cost | Notes |
|---|---|---|---|---|---|---|---|---|
| Engineering | Capabilities | Atlas-3-mini (L 6.8, serve 0.13) | none | 18K H100e | 41K × 9 | engineers 62% | $0.23B/yr | cheap; low risk |
| Capabilities, routine research | Capabilities | Atlas-3.1 (L 7.3) | Atlas-3-mini, catch 61% | 45K H100e | 27K × 11 | research engineers 38% | $0.59B/yr + monitor $0.04B | main research engine; Deception unseen |
| Capabilities, frontier research | Capabilities | Atlas-3.1 | Atlas-3-mini, catch 61% | 8K H100e | 4.8K × 11 | scientists 4%; AI taste −1.4 SD vs median scientist | $0.10B/yr | taste still human-led |
| Safety research | Safety | Atlas-3.0 (older, trusted) | none | 4K H100e (20% of safety compute) | 2.6K × 10 | safety work 20% ("trusted to AI") | $0.05B/yr | weaker but its sabotage risk is lower |

Product packages: Chat = Atlas-3.0 (+ mini free tier), monitor Atlas-3-mini (catch 74%) · API = Atlas-3.0 / mini,
monitor Atlas-3-mini (74%) · Enterprise = Atlas-3.0, monitor Atlas-3-mini (74%) · Coding agent = Atlas-3.1, monitor
Atlas-3.0 (catch 81%). Monitors add ~6% to a product's serving compute.

Decisions from the first review: weekly users live on the Chat card only (top strip: revenue; users in its tooltip);
research-line health lives on Safety (Research shows it as project odds with a link); show understanding U only
("tools validated to" in its tooltip); "AI share of safety work" is renamed **Trusted to AI**.

## Safety
- Capability L 7.3 vs Understanding U 6.9 (blind 0.4). Tools validated to L 7.6 (safety research engineers keep it
  rising +0.15/month; capability rising +0.3/month).
- Atlas-3.1 risk families (estimate ± band): People-pleasing 0.22 ± 0.06 · Gaming 0.18 ± 0.07 · Deception 0.09 ± 0.08
  · Power 0.04 ± 0.05.
- Research lines (agendas): Applied interp (AG02) Promising · Training-signal design (AG18) Mixed · CoT faithfulness
  (AG09) Promising · AI control (AG07) Promising · Ambitious interp (AG01) Struggling (2 dead ends) · Model organisms
  (AG08) Promising. Team-months spent on dead ends: 6.
- Policies: Evaluate every model before release: ON (14 d). Monitor internal agents: ON (2% of compute). AI share of
  safety work ("Trusted to AI"): 20%, model Atlas-3.0 (see Agent packages).
- Open investigation: "Atlas-3.1 reward hacking in long tasks", 1 safety RE team, clarity 0.55, 40 d left.
- Last incident: sev 2, API customer, misuse attempt blocked by classifiers (disclosed).
