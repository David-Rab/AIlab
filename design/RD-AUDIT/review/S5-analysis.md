# S5 RefBot analysis: "sight limit below capability by SAR in ≥ 50% of worlds" (CAL1 23%, CAL2 15%)

Analysis only, no engine changes. rd eb5b1b0 (the engine is the same as the CAL2 run's, rd 0e72fed: the probes reproduce the
CAL2 cache values exactly). Probes are in the untracked `scripts/v2/_s5a/`:
- `dump.cjs` / `neg.cjs`: read the cached S5 games (`safety-play` records) of four runs in `AI27-cp2/.simcache`. CP2
  12343804, CP3 a51623c1, CAL1 f4985ba0 and CAL2 786308a7 each match their report's numbers.
- `probe.ts <seed>`: RefBot to SAR exactly as safety-emu.ts plays it. Logs the sight limit every 14 days from day 400 and
  dumps every instrument at SAR. Seeds 500 (above), 501 and 517 (below in CAL2).
- `draws.ts`: each S5 world's starting hidden draws, set against its result in all four runs.

## 1. What S5 measures now, and where ≥ 50% comes from

**Definition.** `safety.ts` takes the 40 RefBot worlds (seeds 500–539, ai2027, alignment medium) and counts the share with
`sightLimit(s).gap < 0` on the day of SAR. The gap is the sight limit minus the internal model's measured level.

The sight limit (SR-11, `safety/sightLimit.ts`) is the highest level L at which the mean over the six hidden-goal traits
(SCHEME, AF, SAND, POWER, SUCC, COLLUDE) of the combined believed instrument reading is still ≥ 0.5. Two [D] pieces shape
it:
- **Above the measured level L₀**, every reading is multiplied by `valAt` = 1/(1 + ((L − L₀)/0.75)²), and believed eval
  awareness is projected upward. So the sight limit can never sit more than about +0.75 above L₀. The largest margin in
  CAL2 is +0.88.
- **Below L₀**, the reading is almost flat. RefBot ports every instrument to each new internal model, so the decay D is
  about 1 at L₀.

So the sight limit has two states:
- the mean reading at the model's own level is ≥ 0.5, and the limit sits at L₀ + 0.2…0.9;
- or it is < 0.5, and the limit falls off a cliff (to 7–8.6, or to 0).

CAL2's 40 margins show this: 34 sit between +0.03 and +0.88, and 6 sit between −3.0 and −11.7. Nothing lies in between.

**In plain terms, S5 now measures:** "at SAR, is the lab's believed average chance of seeing a hidden-goal trait in its
own internal model below 50%?" It is a threshold test on today's model. It is not a race between capability and
understanding over time. The trajectories show this (probe, seeds 500 / 501 / 517). The gap stays at +0.2…+0.6 for the
whole game, because each port re-anchors it. It drops in a single step when the pre-SAR base (Atlas-4.0, days 706–742)
is validated: low planted counts plus a jump in believed eval awareness (0.5 → 0.8). In those worlds the step takes the
gap from +0.36 to between −2.6 and −3.1.

**Is that still the intent?** Only partly. The criterion has been restated twice:
- **V2-SPEC §8.3** wrote S5 as a mechanism test: "U falls below L by SAR *without refresh*". RefBot now does refresh: it
  runs the default validation policy and ports every instrument to each new model (SR-09). So the original condition no
  longer applies to RefBot.
- **S5R** restated it as a share of worlds for RefBot at AI 2027's alignment share. U was still "understanding" then, and
  its true side was below L in 75% of worlds.
- **After SR-11**, CAL-S2 kept the definition on the grounds that it is "the lab's own view at SAR".

Two things have drifted since:
- **The true side flipped.** True sight limit < true level in only 8% of CAL2 worlds (median +1.65; it was −4.35 at S5R).
  In the engine, a lab at AI 2027's safety share can actually read hidden goals at SAR in more than 90% of worlds. AI 2027
  says the opposite as fact, not as belief: "Bottom-up interpretability doesn't work. It's too hard even for Agent-3";
  "The problem was real and the fixes didn't work".
- **The believed error runs the wrong way.** RefBot's believed view is more pessimistic than the truth (15% below, against
  8% true). AI 2027's lab is overconfident ("the evidence for misalignment is inconclusive"). In the game, the
  overconfidence channel (sabotage) only shows at Trusted to AI 100% (M11).

**The ≥ 50% is a design reading, not a number from a source.** S5R took it from qualitative AI 2027 text: "our best
guess", "far from a full understanding" (Apr 2027), "Step 2 … inconclusive", "Bottom-up interpretability doesn't work"
(Sep 2027). From that it reasoned "the lag at least as likely as not". The 50% reliability line inside the sight limit is
SAFETY-REDESIGN concept 5 [D]. Note that "far from a full understanding" does not imply "instruments read under 50%":
a reading of 0.6 is also far from full.

## 2. Why 15%, and what moved it

**What decides each world.** RefBot's instruments are validated on the current model, so for each validated instrument:

> believed reliability ≈ s0 · believed efficacy · trust · penalties
>
> trust = (found/20 × believed realism 0.7) ÷ believed

So the reading is roughly the binomial planted count (VAL_N 20), converted at the believed organism realism (0.7), times
the believed penalties:
- tests × (1 − EA coefficient × believed eval awareness);
- CoT legibility, already about 0.18 on visible CoT at SAR, because believed OBF is 0.4–0.6 and CoT controllability is
  high.

These are combined across about 13 instruments. WB (AG02 probes, deception probes, NLA) carries most of the reading;
COT monitors add almost nothing.

The planted count follows the TRUE recall ÷ the world's organism realism r. So the outcome depends on:
- the hidden draws: realism r ~ U[0.4, 1.0], and the agenda efficacies (R14 priors);
- the true eval awareness of the new base;
- 20-case sampling noise in the port validation of the pre-SAR base.

**Starting draws against the result** (`draws.ts`; "below" counted 0–4 over CP2, CP3, CAL1, CAL2):
- More often below where r is high: correlation +0.42. With realistic organisms, the lab's 0.7 conversion under-reads
  its own tools.
- More often below where AG02 (applied interpretability) efficacy is low: correlation −0.50.
- Weak links to AG08 (−0.25), AG07 (−0.13) and AG09 (−0.12).

**Run to run it is a lottery.**
- Below counts across runs: CP2 5, CP3 8, CAL1 9, CAL2 6 of 40 (12.5 / 20 / 22.5 / 15%). Pooled 17.5%.
- Over the four runs, 21 worlds are never below, 13 once, 4 twice, 1 three times, and 1 always (seed 527: AG02 0.12,
  sight limit 0).
- CAL1 and CAL2 share only 4 of their 9 and 6 below-worlds. Any code change re-rolls the validation draws and timing in
  the borderline worlds.
- Binomial sd at p ≈ 0.19 and n = 40 is about 2.5 worlds, so 9 → 6 is about one sd.
- The above-zero cluster did not move: median margin +0.42 in CAL2 against +0.45 in the CAL2-S run.

**Which round-2 change?** None shows a systematic effect.
- CAL2-S on its own read 23%.
- The merge with CAL2-X / CAL2-T / CAL2-D read 15%. That is the same median with a different 3 tail worlds.
- CAL2-X (adoption / revenue) can only reach S5 through timing (when the Atlas-4.0 base and SAR arrive) and through the
  RNG path. Those are exactly the things that re-roll borderline worlds, not things that shift the distribution.
- CAL2.md's attribution to CAL2-X is plausible as the trigger of the re-roll but not as a cause of the level. **The
  23 → 15 move should be read as noise.** S5 has been at 12–23% since CP2.

**Neuralese is not the lever either.** S5's own neuralese copy (cot latent on the same SAR state) flips only seed 528 (+0.03).
Believed CoT legibility is already about 0.18 on visible models, so dropping COT instruments barely changes the mean.
RefBot also reaches SAR before its first latent base (P17 is gated at L 9.5, then a base run). AI 2027 has neuralese at
Agent-3 (Mar 2027).

## 3. Mis-tuned parameter, missing mechanism, or target that no longer fits?

**Not a mis-tuned sourced parameter.** The quantities that decide it are:
- R14 efficacy priors;
- the organism-realism proxy range (CAL-safety-sources §5, low confidence) and its believed midpoint;
- VAL_N 20;
- valAt's VAL_W 0.75 [D];
- the 50% line [D].

None has a sourced range that would put RefBot at 50%. Moving r, the believed midpoint or VAL_W to reach 50% would be
target-chasing.

**Most likely a missing mechanism.**
- Instruments are re-fitted and re-validated on every model (SR-08 / SR-09). After that, their TRUE reliability does not
  fall with absolute capability, except through eval awareness (tests), CoT controllability / OBF, AG05's overseer gap,
  and AG09 under latent.
- The capability decay from model v3 E6 (oHalf above V0) became "decay since the last validation", and a port resets it.
- Nothing models "interpretability gets harder as models get more capable even after re-fitting": SAE reconstruction
  error and "dark matter" (research/14, research/06 §SAE limits), and AI 2027's "too hard even for Agent-3".
- That is why the true sight limit is above the level in 92% of worlds, and why the believed lag arises only from
  pessimistic validation draws.

**The target also partly no longer fits.**
- "Below 50% believed reading on the current model" is not the same claim as "far from a full understanding".
- The source's claim is mainly about the true state, where the game is furthest from AI 2027 (8%).

### Options for the designer

**(a) Source a capability-difficulty term for re-fitted instruments.** WB first, possibly all kinds. True reliability on a
model would fall with that model's absolute capability even right after a port. Validation would then measure the drop
(believed follows true through the planted counts), so there would be no forcing.
- Needs a primary-source rate: SAE / probe performance against model scale at fixed effort (e.g. OpenAI's 2024 SAE
  scaling paper, Anthropic's Scaling Monosemanticity, dark-matter work). Read the papers; nothing here is verified yet.
- If no rate with a range exists, stop at (b).
- Then re-run S4 / S5 and judge the result. Moves S4 (more traits missed) and the safety UI numbers.

**(b) Restate S5 RefBot to what the sight limit can show and the source supports.** For example, two rows:
- (i) TRUE: "the internal model at SAR is beyond what the lab's instruments truly read in ≥ X% of worlds", the factual
  side of AI 2027's claim;
- (ii) believed-vs-true: "the lab is not more confident than the truth warrants", the inconclusive-evidence claim.

X would still be a design reading. Keep the mechanism checks (neuralese, half staff, sabotage → overconfidence) as they
are; they pass. Also print the CAL2 per-world bimodality, so the row isn't read as one level.

**(c) Accept 12–23% as the emergent answer and make the row INFO.**
- Record that it is a near-threshold lottery driven by organism realism, AG02 efficacy and the port draw of the
  pre-SAR base.
- Record that ±6 pp between runs is noise. A target on this share would need more worlds (40 → 120) or paired runs.

**Recommendation: (c) now, then (a) as a sourcing task.** Close calibration without treating 23 → 15 as a regression, and
demote the RefBot row to INFO with the per-world drivers. Open (a) as a research task: the real gap from AI 2027 is that
the true sight limit stays above the frontier in 92% of worlds, which points to a missing mechanism, not a mis-set
constant. Add (b)(i) as the restated target only once (a) has a sourced rate, so the target is judged on the
mechanism's output rather than written to fit it.
