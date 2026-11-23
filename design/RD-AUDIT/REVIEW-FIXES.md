# Post-compaction review: fix batch (RF)

From the three reviews in `review/` and the designer's answers (DECISIONS.md "Post-compaction review decisions").
Numbers are NOT re-sourced here (decision 1): that is the first step of calibration. Each task: tsc + its own check,
one commit + a BUILD-NOTES block. No calibration runs. Reference = the review finding named.

## Lane S1: safety rules and readouts (branch rf-s1)
| ID | Task | Source |
|---|---|---|
| RF-S1 | Framework hold and trusted-watcher rule read the 90% upper bound of the belief; drop the clarity gate; add OD-6's capability clause | safety #1, decision 4 |
| RF-S2 | Framework replaces old pledges / pause commitment (`noDeployAbove`, `frontierPauseUntil`); fixed packages become one "meet my framework" package, applied by default; fix SR-20 self-copy watcher fallback and RefBot's cheap-monitor choice | safety #4, #14, decision 9 |
| RF-S3 | Oversight truth hygiene: `believed` flag required (or split true / believed catch); engine catch roll uses true strength; package preview reads beliefs; Publish preview "+0.02 rivals' alignment" leftover removed | safety #7, #13 |
| RF-S4 | SR-05: default model = riskiest running model, lab number = max with its model; remove the 0.4 danger line | safety #9 |
| RF-S5 | SR-10: validation trust per model, not one global factor per instrument (DISAGREE_DROP number kept, decision 1) | safety #8 |

## Lane S2: safety mechanisms (branch rf-s2)
| ID | Task | Source |
|---|---|---|
| RF-S6 | Revert EV9 (8aae8b7): restore the accepted default safety needs order | safety #6 |
| RF-S7 | Revert CP3h(b) `lengthGapOom` (unsourced length grading gap) | safety #3 |
| RF-S8 | Fold Fix environment into Harden: one verb, one cost model, one floor | safety #4, decision 9 |
| RF-S9 | One saturation rule: E02 vs SR-24b | safety #4 |
| RF-S10 | CP3i: at-scale efficacy two-sided around the tested effect; validation narrows the belief; preview in player language (no arXiv cites) | safety #3, #13, decision 8 |
| RF-S11 | SR-21: review's stop rate scales with staffing served; safety spend total complete (or renamed) | safety #10 |
| RF-S12 | SR-17: replace the case clarity rate per SAFETY-REDESIGN §6 #7 | safety #5 |

## Lane P: products (branch rf-p)
| ID | Task | Source |
|---|---|---|
| RF-P1 | Delete RD-P07b; seed every lab's (player, rivals, China) day-0 tools from what it shipped by 2025-07-01 (primary sources: vendor docs / announcements); keep P07's lag rule only for tools new in-game | products F2, decision 2 — done 449380a |
| RF-P2 | Delete the rival auto sector-adaptation rule (RIVAL_ADAPT_GATE_A etc.) unless something critical depends on it | products F3, decision 3 — done 9015cc8 |
| RF-P3 | Certification per DD-04: lifts friction for that product's buyers, not a gate on the adaptation | products F4 — done 51291c2 |
| RF-P4 | Brand counted once: delete BRAND_INSTALLED double count of the customer stock | products F6 — done 4fcd16f |
| RF-P5 | Duplicate-seller exploit: one nest per provider (or forbid same channel + same model twice) | products F7 — done 381c700 |
| RF-P6 | releaseOpen preview reads believed rival / China levels, not hidden state | products F8 — done 059cb39 |

## Lane R: research readouts and measurement (branch rf-r)
| ID | Task | Source |
|---|---|---|
| RF-R1 | Delete LEADER_CAL (data + read at rivals.ts) | research F2 — done 141646f |
| RF-R2 | Measured level pools all suites per version (inverse variance, current edition); band shrinks with suites; restore EV2 monotone-precision check | research F4 — done 142b897 |
| RF-R3 | Restore a real runEvals preview-vs-result check (016a173 made it a tautology) | research F6 — done f1f9251 (check fails on the CP1 fixture: drift, see BUILD-NOTES) |
| RF-R4 | Research speed and capEta from observed progress; believed elasticities stay | research F7 — done ae6b80c |
| RF-R5 | Know-how: totals shown from believed estimates until measured (stackViews truth leak); measured gain shown once per model, not per idea | research F5, F8.1 — done ea4d99a (Not trained in / Software progress still true: see BUILD-NOTES) |

## Analysis (no code)
| ID | Task |
|---|---|
| RF-A1 | Rival safety physics analysis — done: review/rival-safety.md; designer: leave as is, dedicated rivals session later |

## Deferred to calibration (decision 1)
Source or refit: product tool shares, Companion ×1.2, Memory ×1.3, Computer use +0.25, ADAPT_COVER, CERT_CASH / CERT_DAYS,
KYC_REVIEW_COST, KYC_REFUSE, DISTILL_HARVEST_SHARE, BRAND (if kept), DISAGREE_DROP, organism realism range, China
`chinaEfficiency` (designer was told equal efficiency), preset `efficiency`, slow preset r 1.2 → 4.0, CP3h(a) grader
gap, CP3f U05_SHIFT, misuse per token vs per user, uncommitted CP3l edits on p3-d (slow compute path).

## For the rivals session (not this session)
- Rival safety physics gaps: review/rival-safety.md (options A/B/C).
- Day-0 tools from history (RF-P1): a lab that lacked a tool at the start never catches up (Anthropic never gets Memory;
  xAI / DeepSeek never get computer use or voice & vision). Should laggards catch up after the lag rule?
