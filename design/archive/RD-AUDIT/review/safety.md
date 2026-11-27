# Review: post-compaction SAFETY work on `rd` (independent, read-only)

Scope: SR-14b, SR-15, SR-10, SR-16, SR-16b, SR-17, SR-18, SR-19, SR-20, SR-20b, SR-21 (+53cc271), SR-22, SR-24, SR-24b,
SR-07, SR-07b, SR-05, CP3f (×2), CP3h (×2), CP3i, the RD-M01 follow-up (bada45f), and the safety parts of merges 21447df,
1bd89da and af78cf8. The yardstick is SESSION-HEAD.md, then DECISIONS.md, then SAFETY-REDESIGN.md (OD-1..11, §8.2 rows).
I did not run anything. Two helpers reviewed parts of the work: one took SR-19..22, the other SR-15, SR-24b and
CP3f/h/i. I spot-checked their key claims in the code (framework trigger, trust rule, CP3h stand-in, rival trait step).

## 1. Overall verdict

The safety work after compaction is **mostly on plan, not garbage**. Almost every commit maps to a §8.2 row or to a
designer decision, the belief side is largely disciplined about hidden truth, and the big deletions the redesign asked
for did happen: targeted training, the instant fixes, the eval gate, E17 as a trigger, the claim pool and the cost-ratio
watcher.

The problems sit in four places:

1. **The two rules that carry judgement invert the redesign's key principle**, "ignorance shows as risk". The framework's
   misalignment trigger and the "trusted watcher" rule read the best-guess estimate, and the framework also requires
   clarity above 0.4. So a model the lab knows little about is never held and counts as trusted.
2. **CP3f, then CP3h, then CP3i is a chain of mechanisms added under calibration pressure**: S4 went 0.09 → 0.49. Some of
   it is sourced. One piece (CP3h's task-length grading gap) has no source for its size, and several stand-ins lean
   toward the target.
3. **"One mechanism per job" is broken in several places**:
   - suite hardening and environment fixes;
   - E02 accumulation and SR-24b saturation;
   - the framework and the old pledges / pause commitment;
   - static packages and the framework rules.
4. **Rivals are not on the same physics** (DD-18). None of SR-15, SR-24b, CP3h or CP3i reaches `rivalTraitStep`.

Only two items warrant a revert: EV9 and CP3h's length gap. The rest is fixable in place.

## 2. Per task

| Task | Commit | Verdict | Reasons |
|---|---|---|---|
| SR-14b | e87b5df | **KEEP** | Matches §3.4 P1 / I5 / OD-11: inoculation becomes a method, Heavy is intensity only, Retrain-against moves to methods. Left undone: Heavy still hides the alignment audit (`pendingAudit`, OC_VIS_AUDIT), which §3.4 / §3.6 make a case type. |
| SR-15 | 703875f | **KEEP** | Efficacy scaling s0 = 1/ē. The prediction runs the same `runEnv` on believed values (one mechanism); no truth read found. Its linear form allowed 100% cuts, which CP3f fixed. |
| SR-10 | c1cbb30 | **FIX** | The disagreement record and chip are what §4.3 #2 asked for. Unasked: every disagreement automatically cuts believed reliability by 10% on both sides (`DISAGREE_DROP` 0.1, `FLOOR` 0.5, `TRUST_MAX` 1.5, all [D]; data/v2/agendas.ts:141-153). The trust factor is one global multiplier per instrument, not per model (techniques.ts:41). "trustOf" now means two things (disagreement.ts vs trusted.ts). |
| SR-16 | ee3a911 | **KEEP** (see SR-16b) | An owned fix per RL family, reused, floor ×0.2 [D: V2-SPEC]; the old free global edge flags are deleted. Good. |
| SR-16b | 33b2a1e | **FIX** | The fix taking engineer time is right (§3.7 "effects take time"). But the Environments tab now has two verbs that cut the same quantity, suite exploitability: **Harden** (cash and team-weeks, `x → floor + (x − floor)(1 − cut)`, suites.ts:142-148) and **Fix** (×0.3–0.6, floor 0.2, safety engineers, envFix.ts). They have different costs, staff and floors. |
| RD-M01 follow-up | bada45f | **KEEP, FIX defaults** | Physics on true levels with readouts on measured levels is the right split. But (a) `believed = false` is the default on every helper, so any caller that forgets the flag leaks truth into a readout. Example: the SR-20 package preview `internalCharges` calls `useControl` without it (packages.ts:93), so the previewed Slowdown reads true levels. (b) The engine roll in `catchRate` still uses *believed* containment-tool strength (products.ts catchRate → `containment(…, true, true)`), so beliefs drive physics. |
| SR-17 | 121f2e2 | **FIX** | It added a preview and a "what changed" verdict, which is good. It did not do the core §6 #7 replacement: the made-up clarity rate `g·√(fte·m/15)·min(1.5,(h/ref)^0.2)` (investigations.ts:158-161) still drives cases, "clarity" is still the concept, and the verdict weights stay ad hoc (0.08·(1−x), 0.3/0.45, …). BUILD-NOTES:3105 admits "the case rate formula itself (SAF-25) is unchanged". The preview's "width after" is only right for a confirming verdict. |
| SR-18 | f5b145e | **KEEP, small FIX** | Cause-aware menu, disclosure as a separate policy with the legal-minimum default (OD-8), and the deletion of targeted training and disclose-as-fix all match §3.7. The problems: the "cause" is a fixed trait list (`SIGNAL_TRAITS` RH / TGAME / PROXY → only "Fix environment" is offered), not a case verdict. The engine refuses off-menu responses, which is stricter than "offered". The `METHOD_TRAITS` fit table is [D]. |
| SR-19 | b64c7e2 | **FIX** | The rules engine and holds are right, and the override preview matches apply. But: (a) the trigger is `b.est > t.est && b.clarity > t.clarity` (framework.ts:46-48), i.e. best guess plus a clarity gate, where §3.8 asks for the upper bound of "act against the lab"; ignorance never holds. (b) The old publish pledges and pause commitment still run beside it (actors/actions.ts:118-124, commitments.ts:152). (c) There is no "validated on it" or "audit case passed" evidence, and the framework never opens cases or queues validations. (d) E17 was deleted entirely, story beat included. |
| SR-20 | d71b6b4 | **FIX** | (a) The packages are three hard-coded bundles (packages.ts:39-43), not derived from the rules, so editing a rule desyncs them. (b) No package is the default for any deployment type (§3.3 asks for one). (c) The trusted rule reads the best-guess estimate only (trusted.ts:20-29) and lacks OD-6's "below scheming-capable level" clause. (d) It falls back to a self-copy watcher (trusted.ts:54), which §3.3 forbids. |
| SR-20b | df33874 | **KEEP for products, FIX for RefBot** | Products on the one picker is good. RefBot lost its AI 2027-sourced "weaker monitor at ~10% cost" behaviour (bots/ref.ts:199-220), a calibration-moving change without a source. |
| SR-21 | 7f57afc, 53cc271 | **KEEP with fixes** | One needs list, evals on safety engineers, claims deleted: all as §5. But human review and spot-checks were placed at the head of the list, which §5 does not include (lead). Review stops acts at full strength even when unstaffed (`needServed('review')` has no reader). `safetySpend` leaves out scientists, idle payroll and product monitor billing (spend.ts:60-65), so the "Safety spend $/yr" label overstates what it covers. |
| SR-22 | 19c7fd1 | **KEEP** | Matches §3.10. Minor: `believedSpotCatch` maps level to OOM through `s.hidden.timeline` (workPackage.ts:59). This is likely a pre-existing pattern; check it. |
| SR-24 research | 85747ed | **KEEP** | Primary sources, honest grades. Spot-checks hold: collusion 0.41 from Greenblatt Table 6; 120 engineer-days ≈ 2× the Taylor round. |
| SR-24b | 6021fb9 | **FIX** | (a) Organism realism U[0.4, 1.0] takes OD-7 branch (a) ("if research finds a range"), but the research found no direct range: 0.43 is AuditBench's spread between organism builds, not organism → natural. That makes it a lead call, not OD-7. (b) Saturation replaces E02 for the player only; rivals and base / distillation runs keep E02. Two mechanisms do one job. |
| SR-07 | 5e0c073 | **KEEP** | k of n with Wilson intervals, the test-vs-real gap from the published confound, readouts on beliefs and records only. `ALIGN_EVAL_N = 40` was chosen to reproduce the old SD [D] (minor). |
| SR-07b | 602ccc7 | **KEEP (lead)** | Beliefs now live on the real-use scale (test rate × believed gap). This is consistent with the trait definition in §2.2 #1, but it was not asked for; confirm it. |
| SR-05 | eb3e3e7 | **FIX** | §4.1 says the default model is "your riskiest running model" and lab numbers are the max over running models. SR-05 defaults to the latest frontier internal model. The "one colour scale" re-anchors the **0.4 danger line** that §2.3 / §6 #13 removed (MisCard still shows "Danger line"), and it has five threshold sets. |
| CP3f | a4745a7 | **KEEP, FIX** | The log-space method form (no 100% cuts) and removing the AG18 double count are sound. `U05_SHIFT` is a unit conversion, but it is hard-coded from ai2027's V0 (data/v2/danger.ts ~L57); write it as V0 + Δ. Misuse and exfiltration thresholds were left on the old scale. |
| CP3f | ffa60c4 | **KEEP (weak)** | Anti-scheming removal read through E12 visibility (Schoen): defensible through the existing "you fix what you see" rule, but loosely sourced. |
| CP3h EV9 | 8aae8b7 | **REVERT** (pending designer) | It reorders the designer-accepted §5 order (cases → validations → evals) to pass an old 14-day test. The real cause is upstream: the policy ports every instrument at 120 engineer-days each. |
| CP3h | 8cca224 | **FIX: keep (a) on a designer yes; REVERT (b)** | (a) The grader gap reuses Engels `gapFactor` (one rule), but it is an analogy (the backdoor-monitor curve applied to RL graders; "expert humans at L10") introduced under S4 pressure (0.117 → 0.329). (b) "Longer tasks are harder to grade" (`lengthGapOom`, traits.ts:180-223) is self-declared "[stand-in, no primary source for the size]": an invented effect. |
| CP3i | 6870f94 | **KEEP, FIX** | Faithful to the designer's S4 decision: hidden q, beliefs on q̄, the preview shows the range. Lead calls: q ~ U[0, 1] is one-sided (methods can only weaken at scale, which pushes P_mis toward the target), k = 2 OOM, and the `METHOD_TESTED_OOM` values, three of them [D]. There is no evidence channel that ever narrows q. The preview text prints arXiv cites and "×a–×b at a typical agenda" (not player language). |
| Merge | 21447df | **KEEP, flag** | The conflict resolution added new framework behaviour inside a merge: every lineup model can hold its product; open weights are never held; held products leave the market mix. All are reasonable under DD-01 / RD-P05, but they are lead decisions nobody reviewed. |
| Merges | 1bd89da, af78cf8 | **KEEP** | Revision renumbering and BUILD-NOTES only. |

## 3. Findings ranked by importance

1. **Framework trigger and trusted rule read the best guess and gate on clarity, which inverts OD-1/OD-6.**
   - Evidence: framework.ts:46-48 (`b.est > t.est && b.clarity > t.clarity`); trusted.ts:20-29 (best-guess only).
   - Effect: a barely observed model with a low mean is never held and is trusted as a watcher. The whole redesign rests
     on "ignorance shows as risk" (§2.4), and "clarity" is a term §2.3 deleted.
   - Fix: both rules on the 90% upper bound of the "act against the lab" Would-try (or the red-flag traits'), drop the
     clarity gate, add OD-6's capability clause.
2. **Rivals run different safety physics (DD-18).**
   - Evidence: `rivalTraitStep` (traits.ts:1406) has none of SR-15 efficacy scaling, SR-24b saturation, CP3h grader gap
     or CP3i at-scale uncertainty; it keeps E02, and its methods hold at any scale.
   - Effect: rival misalignment feeds the endings, so the player and the rivals live in different worlds.
   - Fix: give rivals the same mechanisms as stated aggregate stand-ins, or list each gap explicitly as a stand-in.
3. **A calibration-driven chain of mechanism additions (CP3f → CP3h → CP3i), S4 0.09 → 0.49.**
   - Each step is framed as "the missing sourced mechanism", but CP3h(b) has no source for its size, CP3h(a) is an
     analogy, and CP3i's one-sided q leans toward the target. This is the "Emergent outcomes" rule bent, not broken.
   - Fix: revert CP3h(b); designer yes/no on CP3h(a) and on q's shape (symmetric around 1, or one-sided); re-run S4 after.
4. **One mechanism per job is violated in four places:**
   - Harden vs Fix environment on the same quantity: merge them into one verb (a fix = a hardening pass ordered from an
     incident, one cost model, one floor).
   - E02 vs SR-24b saturation: one rule for everyone.
   - Framework vs the old pledges and pause commitment: publishing = committing to your framework's rules; delete
     `noDeployAbove` / `frontierPauseUntil`.
   - Static packages vs framework rules: one "meet my framework" package computed from the missing requirements,
     applied by default.
5. **SR-17 did not replace the case mechanism** (§6 #7). The made-up clarity rate and ad hoc verdict weights remain under
   a new preview. Fix: a case = engineer-weeks; outcome odds from the chosen instruments' combined believed reliability
   (ρ = 0.5 rule); preview every verdict's width.
6. **EV9 reorders the designer-accepted needs order to pass a test.** Revert. If release evals are slow, limit the
   validation policy to the instruments the rules need.
7. **Hidden-truth hygiene in the oversight helpers.** `believed = false` is the default everywhere (bada45f), and the
   package preview already misuses it (packages.ts:93). The engine catch roll uses believed containment strength
   (products.ts catchRate). Fix: make the flag required (no default), or split into `trueCatch` / `believedCatch`; true
   strength in the engine.
8. **SR-10's automatic trust cut** is an invented effect on beliefs, and the global trust multiplier spreads one model's
   validation to all models. Fix: keep the disagreement record, chip and framework/case hook; drop `DISAGREE_DROP`;
   keep validation results per model.
9. **SR-05 contradicts §4.1 / §2.3.** Fix: default model = the riskiest running model, lab number = the max labelled
   with its model; remove the 0.4 "danger line" from the colour bands and MisCard.
10. **Review safeguard works unstaffed; safety spend label overstates its coverage** (SR-21). Fix: scale review's stop rate by
    `needServed('review')`; make spend complete or rename it.
11. **Organism realism adopted on a proxy range** (SR-24b). Designer: OD-7 (a) on a proxy, or (b).
12. **Migration bloat.** SCHEMA_REV went 70 → 97 with a migration per task, in a development branch whose saves nobody
    keeps. This is unasked work that every merge then renumbers (1bd89da, 21447df). Fix at cleanup: collapse to one
    migration, or drop old-save support for the redesign.
13. **Player-language slips.** The CP3i run preview prints arXiv cites and agenda scales. The Publish preview still
    shows "+0.02 rivals' alignment (shared pool)" (actions.ts PUBLISH), which §3.9 removed. That one predates this scope
    (SR-01's area) but is still live.
14. **SR-20 self-copy fallback, RefBot losing its sourced cheap monitor, no default package**: see the SR-20 / 20b rows.

## 4. Lead decisions needing the designer (yes / no)

- **Order of the safety needs list:**
  - EV9: pre-release evals above validations (reverses §5).
  - Human review first and spot-checks second.
- **Organism realism:** adopted as U[0.4, 1.0] from a proxy (OD-7 (a) without a direct range).
- **CP3h:**
  - graders = expert humans at L10;
  - the Engels backdoor-monitor curve reused for RL graders;
  - AI-critic mixing and a debate credit of 4 OOM;
  - task length follows h50, plus the unsourced length grading gap.
- **CP3i:**
  - q ~ U[0, 1] one-sided;
  - k = 2 OOM;
  - the `METHOD_TESTED_OOM` values;
  - no channel to learn q.
- **CP3f:**
  - the log-space method form;
  - anti-scheming removal scaled by eval-awareness visibility;
  - misuse and exfiltration thresholds left unshifted.
- **SR-24b:** E02 kept for rivals and base runs; validation 120 engineer-days; `VAL_COMPUTE_FRAC` 0.25 unsourced.
- **SR-19:**
  - rule thresholds: Bio/Cyber High L10 / Critical L12, AI R&D Critical L12 holds training, misalignment 0.3 / 0.4;
  - edit limits ±2 L / ±20 pts, rules can only tighten and cannot be deleted;
  - override costs even when unpublished (morale −5, scrutiny +3, credibility −5, a red flag);
  - E17 deleted outright, story beat included;
  - bots auto-override training holds.
- **SR-20:**
  - package contents (defer 10% / 20%, control on Critical products);
  - the self-copy watcher fallback;
  - RefBot moved to the "most capable trusted" picker.
- **SR-10:** trust cut per disagreement 10%, floor 0.5, cap 1.5; one global trust factor per instrument.
- **SR-07b:** beliefs stored on the real-use scale through the believed test-vs-real gap; `ALIGN_EVAL_N` 40.
- **SR-18:**
  - which traits count as a "training signal" cause (RH / TGAME / PROXY);
  - which methods fit which traits;
  - the engine refusing responses outside the cause's menu.
- **SR-05:** default model = the frontier internal model (not the riskiest); five threshold sets.
- **SR-16b:** environment fix kept as a second verb beside Harden.
- **SR-21:** safety spend excludes scientists and idle payroll; SPOT_COST = 1 (SR-22).
- **Merge 21447df:** lineup models can hold a product; open weights never held; held products leave the market mix.
- **RD-M01 follow-up:** monitor and control physics on true levels while containment-tool strength stays believed.

## 5. Not checked in the time

- Did not run anything (no tsc, tests or game); "matches its preview" claims are read from code, not observed.
- The UI side of each commit (Safety.tsx, Evals.tsx, Suites.tsx, Products.tsx, Agents.tsx) only in passing; no
  good-ui / player-language audit of the new cards.
- Did not trace every caller of the `believed` flag beyond the helpers listed. Did not check the SR-15 believed view's
  `methodLines` τ, which may come from the true predicted G (runs.ts ~L586, pre-existing).
- SR-22's spot-check catch, SR-19's override consequences and the disclosure penalties were not checked against their
  research files. The disclosure penalties look pre-existing.
- How the post-compaction tasks interact with the pre-compaction SR-01..14 (e.g. whether the SR-01 preview fixes still
  hold after SR-18 / SR-19).
- The CP3 test suites' meaning: I did not judge whether the S4 band (0.55–0.85) itself is well sourced.
