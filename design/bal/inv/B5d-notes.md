# B5d: classification rulings applied to capability, market, finance

Applied `balance/CLASSIFY.md` to `balance/params/{capability,market,finance}.ts`. Counts are kinds before -> after (sourced / designer / fitted / derived / stand-in / untagged / unclear).

| file | before | after |
|---|---|---|
| capability | 67 / 155 / 13 / 34 / 6 / 58 / 9 | 68 / 168 / 18 / 27 / 6 / 55 / 0 |
| market | 133 / 103 / 12 / 5 / 5 / 75 / 13 | 130 / 129 / 14 / 3 / 6 / 56 / 8 |
| finance | 47 / 98 / 12 / 0 / 0 / 28 / 5 | 46 / 107 / 16 / 0 / 0 / 21 / 0 |

## What moved
- A2/F3: pointer entries are `designer` with `source` (capability designer pointers; market `[Design]`/`[D from ..]`; the 4 sourced outliers `fin.equity.antiDilution`, `mkt.PARTNER_TERMS.asic.{migrationDays,researchMult}`, `mkt.DEBT_TERMS.revolver.spreadBp`).
- A3: `cap.EXPLOIT_START`, `EXPERT_START_T`, `EXPERT_PRICE_B_PER_T`, `P10_SYN_Q_RAISE` -> designer with the source; the three spread tables `mkt.*_SPREAD_BP` -> designer (R15 plus `[D]` mapping); `fin.investors.ipoWindowYear`, `fin.SEAT_STANCE.founder` -> designer; `fin.RIVAL.multiple`, `capGrowthRef`, `fin.STORY.tau` -> fitted (`unnamed`, `targets: []`; tau names the start shares as target); `cap.BENCHMARKS.mmmu.mL/kL` -> fitted `manual` (three named anchors).
- A5 (fitted `manual`): `fin.OUSTER.reluctance`, `cap.P05_ORCHESTRATION.dG` (was `derived`), `mkt.CONSUMER_MKT.paid.p0/p1` (was `derived`; solved by hand from two anchors).
- A7: `cap.V3_CAL.sampled.*` take the ai2027 kinds (fitted, fitted, sourced, derived), `cap.RL_FAMILIES.{swe,mlResearch,longHorizon}.taskH` -> designer (copy of `cap.WORK_TYPES.H`).
- A8: design-doc pointer that states the number -> designer: `cap.ELICITATION`, `SAND_GAP` (V2-SPEC 3.3.4), `cap.SPECIALTY_BONUS` (TECH-TREE 5 T2), `mkt.TEAM_SIZE` (STRUCTURE 4.1), `mkt.ATTRITION_BASE`, `mkt.STAR_HIRE.*` (V2-SPEC 3.4.1), `mkt.ces.{refTotalShare,frontierShare,frontierDays}` (V2-SPEC 3.1.1), `fin.MOOD_WEIGHTS.{financial,mission,independent}` (FINANCE-V3 7.4, values checked against the table), `fin.debt.{commitLeverageWeight,ratingBBB,ratingBB}` (FINANCE-V3 3), `fin.RIVAL.raiseBelowYears` (FINANCE-V3 12).
- A9: the `mkt.PUBLIC_SHARE.*` entries with no override (`[D on [P]]` group comment) -> designer, source MARKET-sources 2.
- A10: `cap.PROJECT_MAX_TEAMS`, `cap.STUDENT_DEFAULT`, `cap.LICENCE_TIERS.defaultT` -> `policy`, actor player (player defaults / planner caps, consistent with `cap.RE_MAX_PER_PROJECT`). Other layers were already consistent with the rule.
- F1: `cap.WORK_TYPES.v`, `mkt.SECTOR_WORK.*.v` -> designer, `research/20-model-v3-calibration.md:583`. F2: `fast.dBM` unchanged (fitted); `slow.dBM` -> designer, "carried default, no refit of its own". F4: `mkt.ECON.hireSlope` -> stand-in. F3, F5 unchanged.

## Not settled by CLASSIFY.md (left `unclear`, market only; 8 entries)
- `mkt.SECTORS.*.use`: a field family mixing survey values (research/22, sourced) and `[D]` for sectors the survey does not break out. Needs per-record entries (B5 D4). Question: split by record, or stay one family?
- `mkt.REGION_SCALE.CN.use`, `.ROW.use` (0.6 x US): the `[P: Anthropic Economic Index]` backs a check, not the 0.6. Question: `untagged` (the tag is not on the number) or `designer`?
- `mkt.LARGE_SHARE.EDU` (F4, kept `unclear`).
- `mkt.PRODUCT_TOOLS.*.fx.*.dG`, `.tokens`, `.share`, `.afford`: per-record mix of `[P]`, `[D]`, `[D stand-in]`, untagged inside one family (B5 D4). Question: split per record.

## Judgement calls to confirm (not obviously covered)
- `cap.START_STATE.*` (15), `cap.E_START`, `cap.B0_PARAMS`, `cap.PHI_FLOP_PER_H100E_DAY`, `cap.IDEA_DEFAULT_TM`, `cap.TRAIN_CAP`: literals whose comment says they were computed. Kept `derived` (the original is a computation); A7 could read them as literal copies.
- `cap.BENCHMARKS.embodied.mL`: `[D]` with m_G computed from one anchor and a stand-in slope. Set to `designer` (source = the anchor); could be `fitted manual`.
- `cap.BENCHMARKS.floor/ceil/mL/kL` (untagged, header cites research/12 0.5; V2-SPEC 3.3.4 has a table): A1 field-by-field check not done here.
- `fin.COMMITTEE_EST` stays `designer`: its comment reports an observation on the bots (13% held), not a tuning step.
- Two-tag `fin.STORY.tau` is `fitted` because the comment names a target (start shares); fit scripts are `unnamed` / `manual`, `fit.targets` empty (B6).
- Designer entries whose evidence has a `[D, spec ...]` pointer to a doc (e.g. `fin.PITCH.*`, `fin.CRED_RUNGS.*`) were not given `source`; only entries with a clear research/design pointer in the list above were.
- Open B-items untouched: `PROMISE_RESULT` comment vs code (B1).
