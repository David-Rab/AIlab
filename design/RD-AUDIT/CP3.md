# CP3 test checkpoint

Worktree AI27-cp2, detached at e749ca2 (Merge p3-d notes: BUILD-NOTES section), 2026-11-23.
Output: cp3-full.txt (Temp/ai27ux/tests); logs in AI27-cp2/.simcache/logs/. No UI test (`--no-ui`), no deep tier.
Fixtures NOT regenerated. One run; classified by reading the logs and BUILD-NOTES only (no bisecting, no probes).

## Totals

- tsc main + scripts/v2: clean.
- test:full (no UI): **10/36 scripts ok, 2235 passed, 159 failed**, wall 26.7 min (cpu 180 min, load 74%).
  CP2 was 16/36 ok, 2276 passed / 82 failed (wall 16.2 min).
- Classes: (a) same as CP2 **36**, (b) calibration moved **62**, (c) outdated test **58**, (d) suspected real bug **3**
  checks + 2 script crashes. Sum 36 + 62 + 58 + 3 = 159.
- Newly failing scripts: data, suites, signals, evals, oversight, lint-hidden, lint-tradeoffs, control. Now passing:
  successor (CP2 fix), finance F8 (was (a) at CP1 / CP2).
- Two scripts still abort early (hygiene, safetyideas; see (d)).

## (a) Same as CP2 (36)

| Check | CP2 | CP3 |
|---|---|---|
| calib V3.7 research speed M ≈ 1 at start | 1.379 | 1.379 |
| fixtures stale: day0, day400, day900, challenger d400, spinout d400 (5) | stale | stale (regenerate at refit) |
| hygiene registry unlisted systems | autoSplit | autoSplit + **safetyFramework** (SR-19, unregistered) |
| hygiene save 42 → 43 monitoring budget = 20% of pool | 0.004 | 0.004 (RD-A05a) |
| lint-ux numbers without tooltip | 4 sites | more sites (adds panels/Safety.tsx:703 etc., SR UI) |
| lint-structure "Safety research engineers by need" > 4 words | fail | fail |
| danger start: SYC and RH common | SYC 0.01, RH 0.16 | SYC 0.00, RH 0.10 |
| sabotage anchor MO 12%; STEER / SUCCSTEER κ (2) | 1.0% | 1.0%, κ 0.397 |
| safetyrates F2 sabotage after learned hacking 6–20% | 1.0% | 0.9% |
| safetyideas P23 CoT family at L 12; lint no flat factor (2) | fail | fail (the lint now also crashes, see (d)) |
| safetyresearch E1 first result, E1 cycle, E1 readouts, E2 m_exp no √M (4) | fail | worst 66.7%; 0.744 T₁; 66.9 / 66.9 d; m_exp 12131 → 13517 |
| products M2 coverage = budget, A5 eng compute → agents, C2c Memory in use, C2c tooltip upkeep (4) | fail | 41948 → 41948 etc. |
| serving S6 scaffold on internal agents | 27.660 → 27.660 | same |
| research dud direction fails after 3 drops; assignment within 5% of optimum (2) | 0 drops; 91.5% | same |
| rivals R6 milestones = λ knots; R8 follower staleness; R9 China first weeks (3) | fail | R6 0/65/184/472 vs 1/85/239/457; R9 day 30/60 now −143 / −223 d |
| ws4 T3 China lead at start 150–200 d; T3 mean lead until theft (2) | 220; 38 d | 220; **3 d** |
| finance F9 FC2 slower-growth multiple | 23.5 vs 23.6× | 2026 23.5 vs 31.9×; 2027 31.8 vs 27.8× |
| worldfx AI-friend share 10% | 3.0% | 3.0% |
| worldfx A2a US hours of AI use ≈ 6% | 7.0% | 7.7% |
| worldfx W4 firm adoption 17–20% | 26.2% | 29.5% |

## (b) Calibration / timeline value moved (62)

Likely tasks, from the BUILD-NOTES "moves calibration: yes / maybe" lines since CP2:
timelines go to RD-T08 (D_eff ≈ 1.20, qualityOffDg deleted), RD-T09 (synthetic mix follows teacher), RD-M01 / M01b
(measured level fitted from benchmarks; 'runs' stream shifted), RD-X03 (rivals train through baseG / rlGains),
RD-X01 / X02 (rival recipe, up to ~1 OOM pretraining recipe; **LEADER_CAL / CHINA_CAL were fitted without them**),
RD-X04 / X04b (every lab absorbs; distillation no longer daily) and the p3-c2 merge (X03 + X02 + X04 + P02 compound).
Finance / market / world go to RD-P01a/b (lineups, real cheap tiers), P02 (rival lineups, students lag 5 months), P03
(channel split), P04a/b/c (bestPublic by offer ΔG, rival domain ideas back in world effects), P07 / P07b (no enabler
cap; every rival has Computer use, Memory, Voice), P08 (rivals adapt every adopted sector), P09 (distillation lift
saturates), P10 (tiers at their own FLOP per token), P11 (brand follows stock), plus the timeline shift.
Safety S4 / S5 goes to SR-01 / 02 / 06 (lead, amplifier, drift deleted), SR-09 (validation jobs), SR-10, SR-12,
SR-13 / 13b, SR-14 / 14b / 15 (methods on every run, efficacy per world), SR-16 (patches per edge), SR-18 (targeted
training gone), SR-19 (E17 gone), SR-20 / 20b (watchers), SR-21 (one safety needs list), SR-07 / 07b / 24b, P10
(misuse exposure).

### calib (26): timelines now much earlier (CP2 was later than target)
| Check | CP2 | CP3 | want |
|---|---|---|---|
| MODEL-V3 §13 frontier G path to 2026 ±0.2 G | pass | worst 0.76 G, 1.77 G/yr | ±0.2 |
| V3.7 METR h50 doubling | pass | 2.4 mo | 4.2 ±1 |
| T1 ai2027 SC / SAR / SIAR / ASI | pass / 844 / 977 / 1033.5 | 499 / 615 / 791.5 / 867.5 | 638 / 791 / 883 / 915 |
| T1 authors2026 SC / SAR / SIAR / ASI | 1433 / pass / 2071.5 / 2700.5 | 1236.5 / 1303.5 / 1722.5 / 2106 | 1495 / 1573 / 2151 / 2975 |
| T1 fast SC / SAR / SIAR / ASI | 849.5 / pass / 881 / 895 | 671 / 685.5 / 702.5 / 709.5 | 880 / 880 / 925 / 956 |
| T1 slow SC | 4720 | 2919.5 | 4758 |
| T1L ai2027 SC / SAR / SIAR / ASI | 429 / 633 / 781 / 837 | 467 / 642 / 775 / 838 | 638 / 791 / 883 / 915 |
| T1L authors2026 SC / SAR | 908 / 992 | 1242 / 1339 | 1495 / 1573 |
| T1L fast SC / SAR / SIAR / ASI | 564 / 606 / 613 / 613 | 719 / 731 / 731 / 737 | 880 / 880 / 925 / 956 |
| T1L slow SC | 1251 | 1820 | 4758 |

Likely: X01 / X02 / X03 / X04 (rival recipe and absorption feed the frontier), T08 (D_eff 1.20), M01 / M01b
(measured levels), P04c / P07b (rival ideas, tools). The 0.76 G path miss and the 2.4-month h50 doubling say the
frontier itself grows too fast in 2025–26, not only the milestone predicate. Readout note: p90 "NaN y" for ai2027 /
authors2026 SIAR and ASI (calib.log:40–46), presumably seeds with no milestone in the horizon; readout only.

### fixtures canary (2)
Player SC 522 (want 638 ±29), SAR 690 (want 791 ±44); CP2 had SIAR undefined. Same timeline shift.

### suites, signals (5)
suites start S2 0.3575 / followers 0.357 / 0.357 / 0.894 (want 0.36 / 0.9); RL optimisation pressure 0.180 / 0.466
(want light ×0.5, heavy ×1.3 within 1%); signals reference post-train S2 0.357 (want V1's exactly); distilled student
AF 0.344 (start 0.107 = shown share). Likely T08 (design options through the draw), T09 (student follows teacher mix),
X03 (reference RL suites). Could be (c) if those tasks restated V1's numbers deliberately.

### safety S4 / S5, safetyrates (7)
| Check | CP2 | CP3 | want |
|---|---|---|---|
| S4 RefBot/medium P_mis at ASI | 0.381 | 0.090 | 0.55–0.85 |
| S5 RefBot U below L by SAR | 13% | 20% of 40 (median U − L +0.39; true below 13%) | ≥ 50% |
| S5 Mixed-bot keeps U ≥ L − 0.5 to SAR | pass | median min margin −3.96, holds 25% | median holds |
| safetyrates F2 inoculation cut Mis / AF / sabotage (3) | pass | 90.2% / 90.8% / 95.4% | 75–90 / 75–90 / 75–95% |
| safetyrates F5 anti-scheming cut | pass | 99.4% | 90–98% |

Likely SR-14 / 14b / 15 (methods on every run, efficacy per world), SR-18 (no targeted training), SR-09 / SR-24b
(validation), SR-07 / 07b (believed traits), SR-21. The inoculation / anti-scheming values are just over the bands.

### evals, safetyresearch (2)
EV9 reference lab's release suites about two weeks: first two 30 / 33 d (SR-21: evals take safety engineers). E2 start:
AI help SAF_EXP 5.9%, first result 67 → 45 d (want a few per cent; SR-21 / SR-13b staffing).

### finance (4)
F6 supplier margin mean 77.4% (want 70–75%); F7 end-2026 valuation $0.97T (CP2 $0.53T; want $1–3T); F11 2027 revenue
$79.0B (CP2 $86.1B; want ~$140B ±30%); FIN6a aggressive pitch: next mark $844.8B above post $664.3B (wants it to fall
back under). Likely P01a/b, P02, P03, P07b, P08 (rivals get tools and sectors; revenue split), and the earlier
timeline (fast marks for FIN6a).

### worldfx (9)
HireRate_SOFT ≤ 10% median 2026-07-10 (CP2 2026-12-22; want Jul 2027 ±3 mo); 25% remote work by AI 2027-03-04 (want
Oct 2027 ±3); U +1 pp 2027-04-13 (want Oct 2027 ±3); equity 2026 +46.2% (want +30 ±10); A2a hours saved 3.4% (CP2 2.9%;
want 2.2%); A2b paid share 5.2% → 9.9% (want 4–9%); W4 aggregate unemployment 0.21 pp (want ≈ 0); W4 22–25-year-olds
−33.8% (CP2 −25.3%; want −19 ±5); W2 Normal Technology TFP +53.9% over a decade (want +0.5–1%). Likely P04a/b/c, P07 /
P07b, P08, P09 plus the earlier timeline. W2 is 50× the band: check first whether the Normal Technology scenario's
capability gate still binds after X02 / X03 (could be (d)).

### rivals / China (1) and ws4 (1)
rivals R5 leader day-0: rs 1.000 but pre 0.480, mid 0.030, ceil 0.046 OOM/yr (X02 / X03 recipe rates); ws4 T3 after a
theft China is ≈ 60 d behind: 9–31 d (X04 / X04b absorption).

### products, serving (5)
products P6 with slack nothing is cut (P10 servedBy / own FLOP per tier); serving S2 $ per H100e (P03 / P10); C1
leader Chat 628M weekly users (want 700M ±10%; P01b / P10); A8 multi-homing 252 cells off, leader 0.390 (P02 / P08);
A7 day 1 free message 0.02 Wh (want within ×3 of 0.24 Wh; P10 nano tier FLOP).

## (c) Outdated test: asserts a mechanism a task replaced or deleted (58)

- **data (8): RD-T08 / RD-T09.** Repetition (f_data at D_eff), Q_REF = 1 (now 1.1988 after T09's even start mix),
  premium licence / quality gain, balanced draw reproduces the start (U 234.5T), reference shares, specialisation,
  s_d,data. T08 made D_eff ≈ 1.20 at the reference and deleted qualityOffDg; T09 deleted SYN_MIX. T08's note says the
  balanced-vs-natural and quality-offset checks need restating.
- **evals (9): RD-M01 and SR-21.** EV2 ×3 (error drawn once and shrunk by weight: M01 deleted `errTrue` and fits the
  level from benchmark scores). EV3 ×2, EV4, EV6 ×3 (eval staff / compute: SR-21 moved eval suites onto the safety
  engineers' needs list and the safety line). EV6 shows "progress undefined" and "ready after 60 d": the rig reads an
  old field; verify it is not a stuck-in-evaluation bug.
- **lint-tradeoffs (14): SR-18 / SR-19.** `safety.disclosurePolicy` scrutiny / trust and `safety.frameworkOverride`
  morale / scrutiny lines "moved: nothing" at days 0 / 400 / 900 (12 shown; 2 more in the log). New actions whose
  effects need a breach / disclosure state the fixture days lack. Borderline (d) if the preview promises a move the
  engine never makes.
- **oversight (7): SR-12 / SR-13.** Catch rate falls with the monitor gap ×3 (SR-12: one monitorStop = watched share ×
  flag rate × acted-on; 0.89 at every gap); collusion T-LOCK halves (SR-13: comms lockdown replaces T-LOCK reads);
  control tax ×3 (SR-13: `controlLayer` flag replaced by safeguard items).
- **products (5): RD-P01a / P08 / SR-12.** P1 leader start "no mini" and P1 D5 sector packs built (P01a lineups, P08
  deleted sectorPacks); P4 catch falls with gap, P5 monitored incidents caught (SR-12); RD-B20 retire preview (P01a / P08).
- **serving (5): RD-P01a / P02 / P07 / P11.** A7 free tier = student one year below (P02 named it); TIERS E8 rival tiers
  at r × price (P02 named it); A5 E7 mini as one more tier (P01a named it); RD-B11 B14 enabler held to adoption (P07
  named it); B6 memory ×1.3 h50 raises agent-hours (P07 / P11 feature changes).
- **lint-ux (2): SR-11 / SR-09 / RD-P06.** Required terms U, gap, validatedTo, blind (SR-11 deleted them), toolUpkeep
  (SR-09), featEffort (P06); "UI terms resolve: U" (a UI string still uses the deleted term).
- **ws4 (2): SR-19.** C1 the framework blocks the breaking candidate naming the clause; C1 the standing breach binds
  (E30). SR-19 replaced the eval gate and E17 with the safety framework.
- **research (1): RD-X04 / X04b.** RD-B16 challenger diffusion as public knowledge (absorption replaced the daily leak).
- **safetyresearch (1): SR-21.** E1 AI labour is the same input as human (ℓ 0.4599 vs 0.5937).
- **safetyideas (1): SR-13.** P15 comms lockdown halves the collusion penalty.
- **control (1): RD-UI0a / SR-07.** E15 perturbing hidden truth: believed 0.9651 → 0.9651, true 0.942 → 0.3925 (the
  visible numbers look right; the failing part is in the truncated message). Verify.
- **rivals (1): RD-X02.** R1 one OOM down the pool divides the rate: 0.4870 vs 0.4870 (rival ideas path changed).
  Verify: an unmoved value could also be a disconnected input.
- **worldfx (1): task not found.** "three World actions registered — wfx.transitionFund, wfx.moonshot". No BUILD-NOTES
  entry found; verify.

## (d) Suspected real bug (3 checks + 2 crashes)

1. **safetyresearch E1 NaN:** `labour-bound ×NaN engineers vs ×NaN compute` (safetyresearch.log:9). A labour-bound
   line's speed ratio is NaN; likely 0/0 in the SR-21 safety needs allocation (compare the CP2 ∞·0 `allocate` fix).
2. **lint-hidden, UI reads hidden state:** `panels\World.tsx:27 … gOfLevel(s.hidden.timeline, L as number)` (measured-
   domain readout, RD-M01 / UI0a era). Broken no-truth invariant.
3. **hygiene migration idempotence (carried from CP2):** `save: the finance migrations 33 → 42 leave an
   already-migrated state unchanged (idempotent)` still fails.
4. **hygiene crash (carried from CP2):** `TypeError: Cannot set properties of undefined (setting 'base')` at
   scripts/v2/hygiene.ts:474:14; checks after it never run (191 run).
5. **safetyideas crash:** `ENOENT … src/engine/v2/safety/understanding.ts` (safetyideas.ts:280, called from :298).
   SR-11 renamed the file to sightLimit.ts; the lint aborts, so later checks never run. Rig fix.

## Calibration targets missed (input for the refit)

**Timelines** (days from start; target in brackets): ai2027 SC 499 (638), SAR 615 (791), SIAR 791.5 (883), ASI 867.5
(915); authors2026 SC 1236.5 (1495), SAR 1303.5 (1573), SIAR 1722.5 (2151), ASI 2106 (2975); fast SC 671 (880), SAR
685.5 (880), SIAR 702.5 (925), ASI 709.5 (956); slow SC 2919.5 (4758). Lead lab (T1L): ai2027 467 / 642 / 775 / 838;
authors2026 SC 1242, SAR 1339; fast 719 / 731 / 731 / 737; slow SC 1820. Frontier G path worst 0.76 G off (±0.2), 1.77
G/yr; h50 doubling 2.4 mo (4.2 ±1); start research speed M 1.379 (≈ 1); canary SC 522 (638), SAR 690 (791).
All are early now (CP2: late), so the refit should start with the rival / frontier growth rates (LEADER_CAL /
CHINA_CAL were fitted before X01–X04).

**Finance / market / world:** F6 supplier margin 77.4% (70–75); F7 end-2026 valuation $0.97T ($1–3T); F9 FC2 slower
growth gets a higher multiple in 2026 (31.9× vs 23.5×); F11 2027 revenue $79.0B (~$140B ±30%); FIN6a next mark $844.8B
over post $664.3B (should fall below); C1 Chat 628M WAU (700M ±10%); A8 leader 0.390 with 252 cells off; A7 free
message 0.02 Wh (0.24 Wh within ×3); HireRate_SOFT 2026-07 (2027-07 ±3 mo); 25% remote 2027-03 (2027-10 ±3); U +1 pp
2027-04 (2027-10 ±3); equity +46.2% (+30 ±10); AI-friend 3.0% (10 ±3); A2a use 7.7% (5–6.5), saved 3.4% (2.2); A2b paid
share to 9.9% (4–9); W4 aggregate 0.21 pp (≈ 0), 22–25-year-olds −33.8% (−19 ±5), firm adoption 29.5% (17–20); W2
Normal Technology TFP +53.9% (+0.5–1).

**Safety S4 / S5 and rates:** S4 P_mis at ASI 0.090 (0.55–0.85); S5 U below L by SAR 20% (≥ 50%); S5 Mixed-bot min
margin −3.96, 25% hold (median holds); F2 sabotage after learned hacking 0.9% (6–20%); MO anchor 1.0% (12%); STEER κ
0.397 vs SAFSAB 1.361; F2 inoculation cuts 90.2 / 90.8 / 95.4% (bands 75–90 / 75–90 / 75–95); F5 anti-scheming 99.4%
(90–98); danger start SYC 0.00, RH 0.10 (common); EV9 first release suites 30 / 33 d (about 14).

**Rivals / China lag:** T3 China lead at start 220 d (150–200); mean lead until theft 3 d (150–200); after theft 9–31 d
(≈ 60); R9 China lead at days 30 / 60 −143 / −223 d (start gap + days since); R6 rival milestones 0 / 65 / 184 / 472
vs knots 1 / 85 / 239 / 457; R8 r0 ePre −0.545 (want −0.565), r1 off; R5 pre 0.480 / mid 0.030 / ceil 0.046 OOM/yr at
the leader's day-0 inputs.

### CP3 outdated tests

Branch `cp3-tests` (from rd), scripts/v2 only; no src change. Of the 58 (c) checks: **deleted 9, rewritten 31, left 18**
(reclassified: not outdated tests).

**Deleted (9):** evals EV2 ×3 (RD-M01: errTrue gone, the level is fitted from scores; rdm01.ts checks the band);
oversight control tax ×3: EXP ×0.97 / SWE ×0.93, misses ×0.45, lane taxes 3% / 7% (SR-13: control is a safeguard item;
_sr13 checks its Slowdown and stops); products P1 D5 sector packs (RD-P08 deleted sectorPacks); research RD-B16 "Software
progress < ½ the old measure" (RD-X04 / X04b: the daily leak it was sized against is gone; now an INFO readout);
safetyresearch E1 "AI labour is the same input as human" (SR-21: one needs list, m × engineers do not all reach the line).

**Rewritten (31 checks):** data ×8 (RD-T08 / T09: quality filter, Q_REF > 1, engine qRel instead of the hand sum, filtered
U, REF_SHARE = start mix reproduced ±1%, G moves by quality + repetition, s_d on the effective share); evals EV3 ×2, EV4,
EV6 ×2 (SR-21: `research.safReAlloc` evals need, compute from the safety line); oversight catch ×3 (true levels Lg) and
collusion lockdown (SR-12 / SR-13); products P1 start lineups, P4 catch on Lg, RD-B20 retire = applied distillation
(RD-P01a / P08 / SR-12); serving A7 free tier = real lineup model, TIERS E8 (no player student required), A5 E7 (mini
appended, minis + 1), RD-B11 B14 bound only, B6 human hours only (RD-P01a / P02 / P07 / P11); lint-ux required terms
minus U, gap, validatedTo, blind, toolUpkeep, featEffort; ws4 C1 ×2 (measuredDom, SR-19 rule names the clause);
safetyideas P15 (lockdown item); rivals R1 (line rates, ±1%); worldfx World actions = transitionFund, moonshot + product.adapt.

**Left (18), reclassified:**
- lint-tradeoffs 14 → (d) borderline: disclosurePolicy (6) / frameworkOverride (6) previews list immediate meter lines
  that the default request never applies (no lag / condition; override with no rule logs instead of refusing); wfx.moonshot
  approval @900; RD-B19 runEvals band: preview ±0.141 (0.2/√nEff) vs fitted sd 0.098 (RD-M01: preview not on fitSd).
- evals EV6 gate none: auto-evaluate queues no basic suite → (d) or (b), not SR-21.
- products P5: 0 incidents in 30000 steps on a forced-trait monitored Chat → (d), verify.
- lint-ux "UI terms resolve: U": src/ui/v2/panels/Codex.tsx:37 `[[U|understanding]]`, CoreLoop.tsx:34 `term: 'U'` → (d) UI fix.
- control E15 day900: readout oversight 0.81526113 → 0.81526112 under hidden-truth perturbation (1e-8 leak) → (d) minor;
  detail now prints oversight / mis.

**Unit note (d):** the safety list's caps are in heads (`allocate(al.heads, …)`), while `capParams` documents team-
equivalents; EV3 now caps in heads (cap × TEAM_SIZE.re).

**Runs (once each; data, evals, serving, ws4 re-run after a fix):** data 64 / 0; evals 25 / 2 (EV6 gate none, EV9);
oversight 28 / 0; products 66 / 6 (P5, P6, M2, A5, C2c ×2); serving 90 / 5 (S2, S6, C1, A7 day 1, A8); lint-ux 2 failed
(U, tooltips); ws4 21 / 3 (T3 ×3); research 51 / 2; safetyresearch 20 / 6; safetyideas 34 / 2 then the (d) ENOENT crash;
control 31 / 1 (E15); rivals 13 / 4 (R5, R6, R8, R9); worldfx 25 / 12. Remaining failures are (a) / (b) / (d) or the 18 left.
