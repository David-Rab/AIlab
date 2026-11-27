# N2a2 result: release cadence and internal model at the start

Source: Epoch ECI file https://epoch.ai/data/eci_scores.csv, fetched 2026-11-27 [P]. The fetch went through a summarising tool, so
rows may be missing (Gemini 1.0 Ultra, Gemini 2.5 Deep Think and similar are absent from what came back); re-check against the raw CSV
when convenient. A "step" is a model whose ECI beats every earlier model of the same lab (same-day releases count once). Window
Jan 2023 to 1 Jul 2025. Google: Gemma 7B (Feb 2024, non-flagship) excluded; the list starts at Gemini 1.5 Pro.

| Lab | Step dates | Intervals (days) | n | Range | Median |
|---|---|---|---|---|---|
| OpenAI | 2023-03-14, 2024-01-25, 04-09, 05-13, 09-12, 12-17, 2025-04-16, 06-10 | 317, 75, 34, 122, 96, 120, 55 | 7 | 34-317 | 96 |
| Anthropic | 2023-07-11, 2024-02-29, 06-20, 10-22, 2025-02-24, 05-22 | 233, 112, 124, 125, 87 | 5 | 87-233 | 124 |
| Google DeepMind | 2024-05-14, 09-24, 2025-01-21, 02-05, 03-31, 06-05 | 133, 119, 15, 54, 66 | 5 | 15-133 | 66 |
| xAI | 2024-12-12, 2025-04-09, 06-24 | 118, 76 | 2 | 76-118 | 97 |
| Meta | 2023-02-24, 07-18, 2024-04-18, 07-23, 2025-04-06 | 144, 275, 96, 257 | 4 | 96-275 | 200.5 |
| DeepSeek | 2023-11-02, 2024-05-07, 12-26, 2025-01-20, 05-28 | 187, 233, 25, 128 | 4 | 25-233 | 157.5 |

Upstart: no releases.

## Data used (scope change from the designer: simple, right shape)
- One cadence for all seven kinds: `RELEASE_CADENCE_DAYS = 119`, the median of all 27 intervals above, range 15-317 days
  (four frontier labs only: 112 over 19 intervals). The per-lab medians are evidence only.
- Internal model at the start = the public model advanced by one release lag, for every lab. The 60-day window and per-lab
  next-flagship entries were removed (they were built first, then dropped on the lead's instruction). Evidence kept: GPT-5 (7 Aug),
  Claude Opus 4.1 (5 Aug), Grok 4 (9 Jul), DeepSeek-V3.1 (21 Aug) shipped within 60 days of the start; no Google or Meta release did.
