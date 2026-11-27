# Capability requirement per product tool (NPC rule, open item O3)

Rule (NPC-LABS.md §7): a lab ships a tool once its PUBLIC model meets the tool's requirement, the tool is in its market
focus, and the build time has passed. This file gives the requirement for each of the 12 tools in
`src/data/v2/tools.ts`.

## The measure

One measure for all twelve: **the model's 50% time horizon in minutes**, `h50Of(w, v)` (models/capability.ts; AGENCY
domain G, calibrated H50_V0_MIN = 203 min = METR TH1.1's GPT-5, x4.2 per OOM). It works for an NPC lab's public model
(no `build` needed: `versionDomainG` falls back to G), it is the measure Agent mode already uses (`measuredHorizonH`
for the player's measured value, `sectorH50` for rivals in `labToolOpts`), and it is the one measure METR publishes for
the real launch models. Per-domain levels (`domains`) and Lg were not used: there is no published level for the launch
models except MMMU for MEDIA (see Creative studio), and the repo's own G anchors (research/RD-MEDIA-PHYS-bench.md:
GPT-4o 26.3, o1 26.9, Claude 3.7 Sonnet 27.5, GPT-5 28.1 on the PatchBench curve) are fitted on SWE-bench, not on the
tool's task. Horizon minutes translate to G by `dG = log(h/203) / log 4.2` (OOM of AGENCY effective compute relative
to GPT-5).

Source for the horizons: METR, Time Horizon 1.1 results file, https://metr.org/assets/benchmark_results_1_1.yaml
(fetched 2026-11-27; page https://metr.org/time-horizons/; method arXiv 2503.14499). p50 horizons in minutes
[P]: GPT-4 3.99, Claude 3 Opus 3.95, GPT-4 Turbo 3.73, GPT-4o 6.99, Claude 3.5 Sonnet (Jun 2024) 11.40, o1-preview
20.33, Claude 3.5 Sonnet (Oct 2024) 20.52, o1 38.83, Claude 3.7 Sonnet 60.39, o3 119.73, Claude 4 Opus 100.37, GPT-5
203.01, Claude Opus 4.5 292.99. Not measured by METR: Gemini 1.5 / 2.x, Grok 2-3, Llama, and the fine-tuned agent
models (deep research's o3 variant, ChatGPT agent, CUA). The horizon is a software-task measure; for non-software tools
it is a proxy for general model strength (the game already uses it so for Agent mode).

"None" means GPT-4 class or below (about 4 min): every model of the July 2025 start satisfies it.

## Table

| tool id | analogue | first real launch (lab, date, model) | that model's capability | proposed requirement | player's own gate / notes |
|---|---|---|---|---|---|
| coding | Claude Code, Codex | Anthropic, 2025-02-24 (preview), Claude 3.7 Sonnet. Codex CLI (OpenAI) 2025-04-16 with o3 / o4-mini (o3 120 min) | Claude 3.7 Sonnet 60.4 min [P, METR TH1.1]; SWE-bench Verified 62.3% (repo anchor, G 27.5) | **h50 >= 60 min** [P] | No player node. Jules (Google) 2025-05-20 not measured by METR. |
| research | Deep research | Google, 2024-12-11, "Gemini 1.5 Pro with Deep Research", Gemini Advanced (blog.google/products/gemini/google-gemini-deep-research/ [P]). OpenAI 2025-02-02, "a version of the upcoming OpenAI o3" (openai.com/index/introducing-deep-research/ [P]) | Gemini 1.5 Pro: no METR value. Bracket by contemporaries: GPT-4o 7 min, Claude 3.5 Sonnet 11-20 min (EmbodiedBench puts Gemini-1.5-Pro level with Claude 3.5 Sonnet, research/RD-MEDIA-PHYS-bench.md). The o3 variant: o3 120 min | **h50 >= 11 min** [D, bracketed] | Player node P05 (Multi-agent orchestration) is a tree idea, not a capability. Using OpenAI's launch (120 min) would make Google, the real first mover, unable to ship; take the earliest launch. |
| backOffice | support and workflow agents | none in the shipped table. Real analogues predate 2025 (e.g. Intercom Fin, Mar 2023 on GPT-4) [press, unverified] | GPT-4 4.0 min; tau-bench gpt-4o 61.2% retail pass^1 (research/MARKET-sources.md §5) | **none** (GPT-4 class) | No gate for the player. Reliability (pass^8 < 25%) is the harness's value, not a launch requirement. |
| clinical | medical scribes, decision support | shipped table: only AMIE, research-only (counts: false). Ambient scribes launched on GPT-4-class models in 2023 [press, unverified] | GPT-4 4.0 min; MAI-DxO study run on o3 (arXiv 2506.22405) | **none** for the tool; stricter [D] option h50 >= 120 min if the designer wants the diagnostic-orchestrator form (o3 is the model it was shown on) | No gate for the player. The regulatory step is certification (CERT_DAYS 240 in HEALTH), not capability. |
| operations | scheduling, dispatch | none in the shipped table | LLM-Modulo planner shown on GPT-4-Turbo, METR 3.7 min (Gundawar et al. 2024, arXiv 2405.20625) | **none** | No gate for the player. The gain comes from hand-built critics, not model strength. |
| defence | Claude Gov, OpenAI for Government | Anthropic Claude Gov 2025-06-06; OpenAI for Government 2025-06-16 (vendor pages, RF-P1) | Built on the labs' frontier models (Claude 4 era, Opus 4 100 min), but the product is a procurement / accreditation product | **none**; the real gate is the 240-day certification (MIL, GOV) already in the game | No gate for the player. No capability bar is supported by the sources. |
| creative | image and video generation | OpenAI DALL-E 3 2023-10 (not checked); Sora 2024-12-09, 4o image generation 2025-03-25, Aurora (xAI) 2024-12-09 [V in tools.ts] | Separate generation models, no METR horizon. The game's MEDIA domain is fitted on MMMU (image understanding): GPT-4V 56.8 (Sep 2023) maps to MEDIA level about 0 (mL -0.2, kL 0.5, floor 22, ceil 89) | **none** (MEDIA level >= 0, equal to h50 >= 4 min) [D mapping] | Player node 'multimodal': adds a modality, not a capability level. No generation benchmark with per-model scores exists in the repo (RD-MEDIA-PHYS-bench.md says so). |
| agentMode | ChatGPT agent | OpenAI, 2025-07-17, ChatGPT agent (o3-class fine-tune; vendor page, V) | o3 119.7 min [P, METR TH1.1], the closest measured model; the agent model itself is not measured. GPT-5 (203 min) came three weeks later | **h50 >= 120 min** [P-analogue] if sourced; the game's 240 min (AGENT_TASK_HOURS = 4 h) is [D] and 2x the launch model | Player gate is already a capability: 4 h. Mirroring 240 min for NPCs delays NPC Agent mode to Claude Opus 4.5 class (293 min, Nov 2025), after the real launch. Open question 1. |
| computerUse | Operator, Claude computer use | Anthropic, 2024-10-22, Claude 3.5 Sonnet (new), API beta (vendor page, V). OpenAI Operator 2025-01-23 on CUA (GPT-4o based, 7 min) | Claude 3.5 Sonnet (Oct 2024) 20.5 min [P, METR TH1.1]; OSWorld 14.9% (Anthropic launch page, MARKET-sources §5) | **h50 >= 20 min** [P] | Player node P06 is a research idea; the capability it implies is this launch model. OpenAI's GUI-trained CUA shows a dedicated model can do it earlier; for NPCs the earliest public-model launch sets the bar. |
| memory | ChatGPT memory | OpenAI, 2024-02-13 test, GPT-4 era (openai.com/index/memory-and-new-controls-for-chatgpt/, V) | GPT-4 4.0 min | **none** | Player node P07 (long context + memory) is a research idea, not a capability. Memory is a product feature; a lab that lacks it lacks it by focus. |
| voiceVision | Advanced Voice, Gemini Live | OpenAI, 2023-09-25, GPT-4V (see, hear, speak; V) | GPT-4V MMMU 56.8 (arXiv 2311.16502) = MEDIA level about 0; GPT-4 4.0 min | **none** | Player node 'multimodal'. Same note as Creative studio. |
| companion | AI Studio characters | Meta, 2024-07-29, Llama 3.1 class (V in tools.ts); Character.AI predates | No METR value for Llama; any 2025 chat model suffices | **none** | Player node 'engagement'. Market focus (consumer, engagement) decides, not capability. |

## What this means for the rule

- Only four tools carry a real capability bar: coding (60 min), research (11 min), computer use (20 min), Agent mode
  (120 min sourced, 240 min in the game today). The other eight are "none" and depend on market focus plus build time.
  With NPC start models at GPT-5 class (203 min), every sourced bar except Agent mode at 240 is met at the start; the
  rule only bites for a lab with a weak public model, or for Agent mode.
- The bars are ordered by real first-launch dates (Computer use Oct 2024, Research Dec 2024, Coding Feb 2025, Agent
  Jul 2025), matching the history the start table encodes.
- All bars are floors on the public model's h50 in minutes (`h50Of`); no new game quantity is needed.

## Open questions

1. **Agent mode: 120 or 240?** The only sourced launch is o3-class (120 min); the game's 4 h gate is a design value
   that also decides what the player can sell. Keep 240 for both (NPC Agent mode arrives with Opus-4.5-class models),
   or lower AGENT_TASK_HOURS to 2 (changes the player's game and the agent-hours the market sells)?
2. **Research: 11 min is a bracket [D].** Gemini 1.5 Pro has no METR measurement. Accept, or use OpenAI's launch (120
   min) and explain Google's real first launch by focus rather than capability?
3. **Should "none" tools be gated at all?** Eight tools need only focus and build time. Confirm that no bar (even 4
   min) is wanted, especially Clinical, where a 120 min orchestrator bar is possible.
4. **Horizon as a proxy for non-software tools.** Computer use, Creative studio and Voice & vision are not software
   tasks. A domain-level bar (AGENCY, MEDIA) would be more faithful but has no published launch-model values beyond
   MMMU (MEDIA about 0 for GPT-4V). Accept the horizon proxy?
5. **Measured vs true horizon.** The player's gate uses the measured horizon (eval suite); an NPC check would use the
   true h50, as `labToolOpts` already does. Confirm.
6. **Unchecked analogues.** Back-office, clinical and operations have no row in the shipped table; their "none" rests on
   2023-24 vendor launches I did not verify [press, unverified].
