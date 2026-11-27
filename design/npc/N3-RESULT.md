# N3 result: M_world(G) and the state-free reference environment

Branch `npc-n3` (off `npc`), 2026-11-27. Spec: `MISALIGNMENT.md` §2, `NPC-LABS.md` §8a. Nothing reads it yet.

**Scope change (lead, designer-approved simpler NPC model):** only `mWorld`. `sigmaCyc` and its grid were built first and then
removed; nothing for per-lab draws or U-mode terms is built.

## What was built
- `safety/traits.ts` (refactor, player path unchanged):
  - **Signals:** `postSignals` / `postHack` are now one-line wrappers over `postSignalsOf` / `postHackOf(lab: SignalLab, ...)`.
    `SignalLab` is what the signals read from a lab: suite families and exploitability, grader soundness, P11, technique
    families, S8. `playerSignalLab(s)` reads the player's state; `referenceSignalLab(hidden)` reads data constants.
    `graderSound`, `missedExploit`, `healRate` were split the same way (`graderSoundOf`, `missedExploitOf`, `healRateOf`).
  - **Environment:** `runEnv` is now the player's `EnvLab` plus the shared `buildEnv`. `referenceEnv(hidden, x, sg, ω, post, G)`
    builds the reference lab's `EnvLab` from the world.
- `src/engine/v2/npc/misalignment.ts`: `mWorld(s, G)`, `mWorldGrid(s)`, `referenceLineage(hidden, G)`.
  61-point level grid (L 0..15 step 0.25, mapped by `gOfLevel`), linear in G between points, flat outside; memo in a
  `WeakMap` keyed on `s.hidden`; no RNG; not saved.
- `scripts/v2/npcMisalignment.ts`: the test.

## The state-free reference environment (what it reads)
- **Suites:** the six start suites at the leader start's exploitability (`startSuites('leader')`). Not `s.setup.start`,
  so the player's start choice does not move the world's curve.
- **Graders:** expert humans at the world's median-expert level, G_SC − Δ_bm (`s.hidden.timeline`); no AI critic, no debate credit.
- **Recipe:** `REFERENCE_POST`, no methods, no P11, no safety techniques, no lab-wide moderators; the recipe's own
  moderators (constitution E08/E29 ×0.7, broad E09 ×0.7), standard removal at plain EA visibility (0.8, no suppression),
  AG18 healing at the world's `agendaEfficacy` (the player's λ2 shift is 0 at the reference).
- **World:** `edgeWeights`, `difficultyMult`, no U-modes, tier from G.
- **S8:** `S8_REFERENCE_FTE` = 562,328 AI FTE (S8 0.079), the leader start's day-0 value, the same in every world and seed
  [D stand-in, as the proposal says].

## Start tools: decided by the lead, reference built WITHOUT them (the 0.015 difference is below what the design needs)
The probe used the player's day-0 state, which carries three active start tools: T-PROP (E01 ×0.7), T-NOISE (E18 ×0.6),
T-TMON (E22 ×0.5). I built the spec text (none). `referenceEnv` takes an optional `extraMods` and the test uses it to
reproduce the probe. Effect on the median M at ASI (12 `tl-central` seeds 1000-1011):

| World | No start tools (built) | With the 3 start tools (probe) | MISALIGNMENT.md §7 |
|---|---|---|---|
| easy | 0.292 | 0.277 | 0.31 |
| medium | 0.433 | 0.417 | 0.42 |
| central-hard (shift 0.4) | 0.507 | 0.492 | 0.492 |
| hard | 0.599 | 0.587 | 0.59 |

Both variants are within ±0.02 of §7 except easy-with-tools (0.033 under; the easy mean over the 12 seeds is 0.313, so
§7's 0.31 may be a mean). If the designer wants the tools in the reference, it is a data constant moderator table in
`referenceEnv` (3 lines); nothing else changes.

## Checks (run: `npx tsx scripts/v2/npcMisalignment.ts`, ~2 min)
- **How the worlds are set:** `defaultSetupV2({ seed: 1000+i, alignment: easy|medium|hard, world: 'tl-central' })`, 12 seeds;
  "central-hard" is `medium` with the latents shifted by 0.4 and D and E19 recomputed (the probe's `shiftWorld`).
- **Sanity at ASI (median over 12 seeds):** easy 0.292, medium 0.433, central-hard 0.507, hard 0.599 vs 0.31 / 0.42 / 0.492 / 0.59: all within ±0.02.
- **Monotone in G:** the largest fall between adjacent grid levels over 48 worlds is 0.0000.
- **Probe identity:** with the three start tools passed as `extraMods`, the state-free lineage equals the probe's player-day-0 lineage to 6.5e-9 (the S8 constant's rounding).
- **No player read:** the curve is identical with `s.player` removed.
- **Runtime of one curve build:** median 30 ms, max 102 ms over 48 worlds, measured with a background fingerprint
  run using another core (so an upper bound); the spec's 20 ms estimate is the quiet-machine figure.

## Identity proof for the player path
- **Full bot fingerprint (`botfingerprint.ts`): not completed.** It runs 36 games; the baseline on this worktree had finished 8
  after 34 minutes (3 in the first 19, while other work shared the machine). That is well over the 20-minute limit, so I stopped
  per the brief. The before and after fingerprints are NOT proven back to back.
- **Substitute proof (function level, stronger on the touched code):** the committed `traits.ts` was copied as it stood at HEAD
  and compared with the refactor on one ref-bot game (seed 5, tl-central, states at day 0, 150, 400, 800), for 4 × 3 × 2 × 4 × 4 = 384
  post designs (all prefs, safeties, RL focus, CoT modes and four method lists) × signals / hack / healRate / `playerEnv` (two
  lineages, two G) / `runEnv` in the believed view, with and without a run policy: **19,968 JSON comparisons, 0 differences.**
  The harness lived in the temp folder, not the repo.
- **Suggested for the lead:** run the full fingerprint once on `npc` after the merge (before and after on a quiet machine),
  or `--seeds 1` (6 games) for a cheaper proof.

## For the lead (shared files, not edited)
- Nothing in the registry, `save.ts`, `types.ts` or the task tables changed.
- N3b (heavy safety raising M) can now be tested on this curve: `referenceLineage` with a different `post`
  (the env hook is `referenceEnv`'s `post` argument).
