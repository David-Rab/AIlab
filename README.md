# AI 2027: The Game

A real-time strategy / tycoon game built on the [AI 2027](https://ai-2027.com/) scenario and the AI Futures Project's forecasting models. You run OpenBrain from July 2025, one day per tick, through the intelligence explosion.

## Play

- **Standalone:** `npm install && npm run build`, then open `dist/index.html` (single self-contained file, works offline).
- **Dev:** `npm run dev`.
- **Controls:** `Space` pause, `1`–`5` speed. Hover anything for details; hold the hover to lock a tooltip and hover its underlined terms for nested tooltips.

## Core loop

- **Compute allocation** between capabilities, alignment, product and security (AI 2027 Compute Forecast shares are the defaults).
- **Progress engine** follows the AI 2027 timelines/takeoff code: Stage 1 is time-horizon doubling to a Superhuman Coder (`M = 1 + p·(s/p)^f`, rate = share·M + (1−share)·compute); Stage 2 spends human-only research-years at 5× / 25× / 250× / 2000× multipliers to SAR, SIAR and ASI. Player compute and talent scale the rate.
- **Hidden traits.** Each model lineage carries ~20 hidden traits (sycophancy → reward hacking → … → scheming, successor hijacking) that drift with capability and training pressures. You see only noisy estimates. Detection is behavioral, chain-of-thought or white-box, each with a weakness (eval awareness, neuralese, capability growth). Training against a detector mostly *masks* traits.
- **Safety research tree** (32 techniques in alignment, oversight, detection, control, governance and security) with real limitations and capability taxes.
- **Actors** (government, public, China, three US rivals) are rule-based reactors with personality presets. "Realistic" draws them by evidence-based weights and keeps them hidden for six months.
- **Decision events** mirror AI 2027 story beats (the heist, neuralese, clearances, the leak, the Oversight Committee, the DPA, Beijing's treaty offer) but trigger on world state, not dates.
- **Endings** scored on five axes: survival, freedom, prosperity, company, geopolitics. The hidden world, true traits and your timeline vs AI 2027 are revealed at the end.

## Worlds and baselines

- **Baselines:** *AI 2027 Classic* (as written, Apr 2025) and *Reality-Updated* (METR horizons, polls, multi-lab frontier through 2026).
- **Worlds:** *Unknown* (sampled from Lifland's Apr 2025 distributions with the source's copulas), *AI 2027 scenario* (scripted: SC Mar 2027, ASI Dec 2027 under race play), *Authors' 2026 model* (AIFM Aug 2026), *Fast takeoff*, *Skeptic*.
- **Alignment difficulty:** Unknown / Easy / Medium / Hard.

Calibration (`npm run sim -- ai2027 3 race`): AI-2027-style racing reaches SC ~Apr–May 2027, SAR ~Aug–Sep, ASI ~Nov–Dec 2027 and ends in takeover. A safety-heavy policy reaches ASI ~Aug 2028 with Committee or Treaty endings, mirroring the Slowdown branch.

## Research

`research/` holds ten source-tagged research files written for this project: scenario events and dashboard values (01), compute and security (02), timelines and takeoff math (03), trait theory (04) and empirical evidence (05), countermeasures (06), actors (07), policy ecosystem (08), reality check (09), and China with Chinese-language sources (10). Some 2026 items are flagged as secondary-source only; check them before quoting in-game.

## Coming

Campaigns as President, General Secretary, the AI model, and safety lead; Reality-Updated start in Nov 2026 with history applied; interest groups and allies (research in 08); richer China model (research in 10).

## Credits

Scenario, forecasts and models: AI Futures Project (Daniel Kokotajlo, Scott Alexander, Thomas Larsen, Eli Lifland, Romeo Dean). This is an unofficial fan project.
