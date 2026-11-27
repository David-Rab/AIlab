# N2a result: NPC headline-lab data tables

Branch `npc-n2a`. Files: `src/data/v2/npcLabs.ts` (types, `KINDS`, `REALISTIC_CAST`, `PUBLIC_NOISE`), `scripts/v2/npcData.ts`
(shape test, passes; also checks each cast lab's tools against `toolsAtStart`). tsc clean. Data only: nothing reads it yet.

## 1. Kinds (7 personality values)

Compute appetite is a yearly growth multiple of H100e. Base 2.25 (compute/market.ts:121) x level word (low 0.8, mid 1, high 1.2, very high 1.5) [D]; leader 4.5 measured.

| Kind | Growth/yr | Funding | Release lag d | Cadence d | Openness | Channels c/a/e | Safety | Race resp. |
|---|---|---|---|---|---|---|---|---|
| leader | 4.5 [P Epoch, derived 386K to 1.743M] | private | 30 [D] | 274 [D] | closed [P] | .37/.23/.40 [press+derived] | .35 [repo] | .8 [repo] |
| safety | 2.25 [D] | private | 120 [D] | 395 [D] | closed [P] | .15/.55/.30 [D] | .65 [repo] | .55 [repo] |
| bigtech | 2.70 [D] | parent | 60 [D] | 365 [D] | closed [P] | .5/.2/.3 [D] | .5 [repo] | .6 [repo] |
| openweights | 2.70 [D] | parent | 60 [D] | 365 [D] | open [P] | .8/.1/.1 [D] | .3 [repo] | .7 [repo] |
| racer | 3.375 [D] | private | 15 [D] | 274 [D] | partial [D] | .6/.3/.1 [D] | .1 [repo] | .9 [repo] |
| upstart | 1.8 [D] | private [press] | 60 [D] | 456 [D] | closed [D] | 0/.7/.3 [D] | .5 [repo] | .5 [repo] |
| china | null (China's meter) | state | 45 [D] | 365 [D] | open while rung < 3 [spec] | .4/.5/.1 [D] | .1 [repo] + actor's 0.4 x concern/100 | 0 [repo], state-directed |

Sector weights (all [D]) are in the file, sum to 1 per kind. Every number carries its tag as a comment in the source.

## 2. Cast (1 July 2025)

| Lab (family) | Kind | Public lag mo | Internal model | H100e | Run-rate $B | Valuation $B | Raised $B | Staff | Tools |
|---|---|---|---|---|---|---|---|---|---|
| Marenth (Solvane) | leader | 0 | GPT-5, ships in 37 d, 2.1 mo ahead [derived] | 0.82M [derived Epoch] | 12 [P company, 30 Jul] | 300 [P] | 34 | 3000 | coding, research, defence, creative, computerUse, memory, voiceVision |
| Lanternworks (Ouvril) | safety | 3.0 | Opus 4.1, ships in 35 d, lag 2.5 | 0.5M [D] | 4 [derived, two company points] | 61.5 [P] | 16 | 1350 | coding, research, defence, computerUse, voiceVision |
| Tarnwick (Davrel) | bigtech | 2.5 | advance by release lag | 1.0M [D] | none | none | none | 6000 | coding, research, creative, computerUse, memory, voiceVision |
| Zorvane (Brask) | racer | 6.5 | Grok 4, ships in 8 d, lag 2.5 | 0.28M [D] | 0.236 [press] | 150 [press] | 17 | 300 core | research, creative |
| Wolderfield (Hollin) | openweights | 9.6 | advance by release lag | 0.6M [D] | none | none | none | 3400 [press] | creative, memory, voiceVision, companion |
| Pellory (Verrin) | upstart | none (band 3 mo [D]) | advance by release lag | 0.03M [D] | 0 | 32 [press] | 3 [press] | 30 [D] | none |
| Xuanmu Lab (Muyi) | china | 6.5 | advance by release lag | China's meter (no number) | none | none | none | 160 [press] | none |

`PUBLIC_NOISE` holds the O4 table as written (capability lag sd 1 month; horizon 0.3; compute 0.2 / 0.3 / 0.5; revenue 0.1 / 0.2 with 30 days stale; valuation 0.05 / 0.2; headcount 0.15; grade 1 step; quarterly cadence for revenue, compute, headcount; exact list).

## 3. Name checks (web search, 27 Nov 2026)

The spec's names mostly collide, so most were replaced.

| Spec name | Finding | Verdict |
|---|---|---|
| Halcyon / Aster | "Halcyon AI" energy-data platform (Series A $21M, Mar 2026) and an anti-ransomware company; several "Aster" models on Hugging Face (OpenAster1) | Replaced |
| Lanternworks | "Lanternworks" returned nothing; neighbours LanternPartners.AI, Lantern (YC), Lantern Studios | Kept (exact name free) |
| Vesper | Vesper AI journaling app, `vesper-ai` PyPI, Vesper 2.0 team AI | Replaced |
| Corvane AI / Tessel | Corvane is a 2025 New York customer-research startup; Tessel is an ML-debugging research lab | Replaced |
| Vektor / Kestrel | Vektor AI (London mentorship; a DeFi tool); Kestrel AI (YC 2025, incident response), KestrelLM | Replaced |
| Fieldstone / Fern | Fieldstone Bio (AI env. sensing); Fern 0.1 is a real LLM by Mirendil (Oct 2026), Fern Labs | Replaced |
| Quillon / Quill | Quillon: accounting-AI startup; Quill: several AI products | Replaced |
| Hengyuan Lab / Heng | Hengyuan Technology (industrial AI, China) | Replaced |

Replacements, each searched: "Marenth" AI (none) / "Solvane" AI model (none); "Ouvril" AI (none); "Tarnwick" AI (none; nearest "Tarnished AI", "Tarsen" was rejected as a near-collision with TarSenS agri-AI) / "Davrel" AI model (none; nearest Davra IoT); "Zorvane" AI (none; nearest Zorvan sales agent) / "Brask" AI model (none); "Wolderfield" AI (none) / "Hollin" AI language model (none); "Pellory" AI company (none; nearest Pelles, Pelly) / "Verrin" AI language model (none; nearest Hugging Face "Verin-V2-Pro", a hobby upload); "Xuanmu" AI lab model (none; nearest Xuanwu models, a different word) / "Muyi" AI language model (none; a personal HF account "muyi666"). "Ashgrove" was also checked and not used. The search tool is a web search, not a trademark register: no match found is not a legal clearance. None is a real name, a parody, or from AI 2027.

## 4. Provenance gaps and findings for the lead

1. **Leader release lag vs GPT-5.** The leader's 30-day lag [D] is shorter than the 37 days GPT-5 shipped after the start, so the spec's own rule ("next release within its release lag") would not pick GPT-5. The spec says to use GPT-5, so the table does. CAST-2025 §5b (METR had it at least 28 days before) points the same way: 30 is the low end. Sourcing release lags is still open.
2. **Release cadence meaning.** BASE_MONTHS is a base-model cadence (9-15 months). The observed public flagship steps (Epoch ECI file) are 1.5-2 months (OpenAI), about 3 (Anthropic), 1-2 (GDM), 3-4 (xAI), 4-5 (Meta), 2-3 (DeepSeek). I used BASE_MONTHS as asked; N2b and the lead should decide which one "public model steps up on its cadence" means.
3. **Spec words vs today's data.** Spec says safety-first and upstart race response "low"; today's raceRelaxation is 0.55 and 0.5 (kept, flagged in the source).
4. **Compute at the start.** Only OpenAI has both Epoch ends (log-linear, 0.82M). The other four are the repo's back-casts [D]; Epoch end-2025 values are in the comments as a check. Upstart 30K is a placeholder [D]. Training share is not in this file (not sourced, CAST §2).
5. **OpenAI channel mix** is derived from a press API share and a floor on subscriptions; it makes enterprise 40%, not "consumer + API" as the spec words it. Flagged, not forced.
6. **Unverified inputs**: xAI revenue, valuation and headcount; Meta and OpenAI headcount; upstart numbers (press only). Upstart start lag is a [D] (6.5 months in the repo for Thinking Machines is in the Notes of CAST, not stored here: `publicLagMonths` is null and the band is 3 months).
7. The internal-model lag for the leader is negative (ahead of the public frontier); N2b must accept that.
8. Tools snapshots duplicate tools.ts `shipped`; the test compares them. Drop both when N4 removes the history list.

## 5. Params to register (for the lead; no registry entries made)

Per kind (7): computeGrowthPerYear (leader 4.5, DEFAULT growth 2.25 and level scales 0.8/1/1.2/1.5), releaseLagDays, releaseCadenceDays, safetyEmphasis, raceResponse, focus.channels weights. Global: PUBLIC_NOISE sigmas (capability lag sd 1 mo, horizon 0.3, compute 0.2/0.3/0.5, revenue 0.1/0.2, valuation 0.05/0.2, headcount 0.15, grade 1 step), revenue staleness 30 d, report cadence 91 d. Cast numbers (start values) are history input, not tunables.
