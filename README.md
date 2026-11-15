# AI 2027: The Game

A real-time strategy / tycoon game built on the [AI 2027](https://ai-2027.com/) scenario and the AI Futures Project's forecasting models. You run a frontier AI lab from July 2025 until superintelligence arrives, the world breaks, someone else gets there first, or you lose the company. One tick is one in-game day.

It plays like Plague Inc. crossed with a company tycoon. Your models are the "virus": they carry hidden dispositions you can only measure imperfectly, and your measurement tools decay as the models get smarter. Meanwhile you raise money, buy chips and power, hire people, split compute, and design, train and deploy models.

## Play

- **Standalone:** `npm install && npm run build`, then open `dist/index.html` (a single self-contained file that works offline).
- **Dev:** `npm run dev`.
- **Controls:** `Space` pause, `1`–`5` speed. Hover anything for details; hold the hover to lock a tooltip and hover its underlined terms for nested tooltips. The Codex explains every term.

## What you manage

- **Finance:** cash, revenue, raises, deals, debt, the board, runway.
- **Compute:** chip orders, data-centre sites, power, cloud. Online compute is split into Training (runs and data generation), Research (experiments and agents, best mix by default), Serving and Safety.
- **People:** capabilities and safety researchers, hiring, morale, star hires.
- **Models:** base and post-training runs with design choices, paradigms, benchmarks, deployments, and the internal agents that speed up your own research.
- **Safety:** research agendas with unknown efficacy, findings, detection tools, investigations, incidents, safety agents.
- **Security:** weight security, siloing, counter-intelligence.
- **Relations:** government, public blocs, rivals, China and research bodies.
- **The outside world** reacts as your models spread: jobs, the share of decisions run through AI, new technologies, markets.

The three tensions are capability vs understanding (two racing bars), speed vs scrutiny and solvency, and openness vs control. Over many seeds, a race-only bot and a safe-only bot both lose; a balanced bot wins.

## Docs

- `design/V2-SPEC.md`: the build specification (systems, equations, calibration).
- `design/ux/`: information architecture, design system, glossary coverage.
- `design/PROGRESS.md`: build status and handoff notes.
- `research/`: source-tagged research behind the numbers (timelines and takeoff, the production function, traits, countermeasures, safety agendas, compute and finance, actors, China, world effects). `research/11-engine-audit.md` audits the engine against the primary sources.

## Tests

- `npm test`: engine and calibration suites (timelines against the golden AI 2027 path, the production-function identity, finance, world effects, actors, safety, lints for hidden-state leaks, UX terms and trade-offs). About 15 minutes.
- `npm run test:ui`: builds, then clicks through every screen in a headless browser and saves screenshots to `scripts/v2/shots/`.
- `npm run bots:v2`: balance harness (race, safe, mixed, capex and reference bots over many seeds).

## Credits

Scenario, forecasts and models: AI Futures Project (Daniel Kokotajlo, Scott Alexander, Thomas Larsen, Eli Lifland, Romeo Dean). This is an unofficial fan project.
