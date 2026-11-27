> **Archived 2026-11-27** from branch `mk-cp` (worktree and branch removed; its rig restatements and rev-110 fixtures were
> outdated against master). Kept as the record of the market checkpoint. Still open from section (b): **1. seat price
> readout** (still `a.seatPrice = o.seat` at src/engine/v2/worldfx/revenue.ts:575, verified 2026-11-27) and **2. Agent mode
> row in Add a tool** (not re-verified).

# MK-CP part 1: run and triage (market redesign checkpoint)

Branch `mk-cp` from master cd352aa (market redesign merged, SCHEMA_REV 110), worktree AI27-mkcp, 2026-11-24, 18:02 to
20:15 (time budget 150 min). The machine was shared (designer playtesting, other sessions): wall times are under load.
Baseline for "already failing": design/RD-AUDIT/CP4.md (incl. CP4b) and, for one item, a probe on the pre-market master
336c5ed (cd352aa^2) in a scratch worktree. Failing tests are information: nothing was retuned, no target was moved to a
new number. Logs: %TEMP%/mkcp/ (quick.txt, cal.txt, cal2.txt, full.txt, logs-quick/, logs-full/, mk/*.log; the runner's own in .simcache/logs).

## What ran

| Step | What | Wall |
|---|---|---|
| 0 | `npm ci` | ≈ 2 min |
| 1 | the known restatements (_mk6 (c), _mk6b (c)), _mk5 reference refreshed; every `scripts/v2/_mk*/check.ts` (15, in parallel) | ≈ 2 min |
| 2 | `fixtures.ts --write` (SCHEMA_REV 110), committed ea8f772 | 2.2 min |
| 3 | `run.ts --tier quick` (6 workers) | 21.7 min |
| 4 | `run.ts --tier cal` (10 workers) | first run stopped at 60 min by the shell timeout I gave it (my error); its 10 prefill shards ran on orphaned and filled the cache by 20:14 (≈ 100 min of wall for 100 cold runs under load); re-run on the cache: 0.9 min |
| 5 | `run.ts --tier full --workers 5 --only ui,safety,finance,worldfx,ws4,hygiene,safetyrates,idle`: the full tier's jobs that differ from quick (the SMOKE suites at full size, safetyrates, test:ui); every other full job runs the same command in quick and full, so its quick result stands (calib's T1 / T1L / T4 are the cal tier) | test:ui done (22.6 min); the rest still running at write-up (safety prefill shards from 18:52, then finance, worldfx, ws4, hygiene, safetyrates, idle queued) |
| 6 | serving and products re-run alone after the restatements | ≈ 9 min / ≈ 2 min |
| 7 | deep | not run (time) |

The cal tier was the long pole: 100 cold calib runs at ≈ 1.2 a minute on the loaded machine.

## Results per tier

| Tier | Scripts ok | Checks passed | Failed | Notes |
|---|---|---|---|---|
| _mk checks (15) | 14 → 15 | 101 → 105 | 4 → 0 | _mk3's 4 were its pinned pre-MK-3 revenue: (a), restated; _mk4 and _mk10 print one summary line |
| quick | 16 / 36 | 2235 | 54 | after the restatements below: 45 (serving 87 / 5, products 64 / 4) |
| cal | 1 / 2 (+ 10 shards) | 41 | 11 | golden-timelines ok; calib 25 / 11, the same rows as CP4 less one (T1L authors2026 SC now passes, 1468 vs 1495 ±29) |
| full (long suites + UI) | incomplete: only test:ui finished | — | — | the SMOKE values from quick stand in below, marked SMOKE |
| test:ui | 0 / 1 | 704 | 16 | 13 = CP4's UB-F list, 3 new (B2 Agent mode row) |
| deep | not run | | | |

tsc (main and scripts/v2): clean.

## Market checks (_mk*)

All 15 pass after the restatements. The five faults of the playtests (MARKET.md "Why") are gone on the designer's saves:
prices are set by competition (MK-6 (a): start leader margin 0.81–0.83 at seeds 2027 / 7 / 42, start at the fixed
point within 0.2%); one model has one price on Enterprise and Vetted (MK-6 (b), MK-6b (c): 42 pairs, gap 1e-16); no
turned-away demand vanishes on the day-296 and day-369 saves (MK-7 (a), (b)); Trusted is gone (MK-1, MK-2); Agent
mode sells agent-hours only where it is on (MK-11). Day-369 Atlas-4.0-mini case (now named Agent-3-1.0-micro):
adding it to Enterprise frees 1.12M H100e of need and costs $11.9B/yr of profit at the next tick (30 days: −$13.9B,
900K H100e); the preview shows exactly that (MK-6 (c), MK-6b (c), MK-12 (c i)).

## (a) Restatements made (the check encoded a removed mechanic or an old number)

| Check | Was | Now | Why (a) | sha |
|---|---|---|---|---|
| _mk6 (c), _mk6b (c) | adding the mini keeps profit (≥ 0.9 × without) | preview = next tick (1.5% + floor, MK-12's tolerance, shared helper `_mkcp/preview.ts`) and the preview reports the trade-off (profit change, compute freed) | MARKET.md "Decisions after MK-6c" | 5e934fa |
| _mk5 (a) reference | ref-day369.json made with allReach only | regenerated with allReach + bestOnly, the mode (a) compares in | MK-5c added the tier-mixed agentK, which bestOnly turns off: the old reference differed by 0.91 at US FIN agentK. Now max gap 7e-15 | 5e934fa |
| _mk3 | revenue = the numbers before MK-3 (pinned) | no effort field; revenue finite, ≥ 0, total = sum (pinned numbers printed) | MK-3's one-time regression held at MK-3 (1faa2a3); MK-5b/5c/6/7/9/11 move this save's revenue by design | 5e934fa |
| serving S3 day 400 / 900 | the rig's offer from offerOf(model, tools) | `...labToolOpts(s, p.tools, sid, model)` as mix.ts builds it | MK-11: harness ΔG, tokens and horizon come through labToolOpts; 45 providers' cost differed ×2 (US SOFT r0 0.354 vs 0.177). Passes | e839141 |
| serving B7 day 400 / 900 | same rig offer | same fix | same cause (k and agent cost of the rig's offer). Passes (CP4 had B7 day 900 as (b): cleared) | e839141 |
| serving D3 day 1 / 400 | agentK bit-identical to the A2c rule at the tier offers' agent price | the A2c rule at MK-6's agent price (c_ag × p/c per tier), the player at MK-5c's tier mix (agentMixOf), relative 1e-9; rig offer with labToolOpts | MK-6 prices agent-hours per tier; MK-5c mixes the player's tiers; MK-11 tool options. 210 / 168 differed, now 0 | e839141 |
| serving B6 | memory pushed onto the start's Enterprise raises agent-hours | on the day-400 fixture's Enterprise with Agent mode, Memory and Deep research taken off first, then added | RF-P1: the start's Enterprise already has Memory; MK-11: agent-hours need Agent mode and its horizon gate, which no start model passes (0 agent-hours at the start with Agent mode on). Passes: 0.70B → 0.83B agent-hours | e839141 |
| serving RD-B11 B16 | Vetted's offer = ×3 Enterprise's (Trusted access) | Vetted's offer has Enterprise's price, cost and fit | M1, M6, "Removed": CHANNEL_PRICE | e839141 |
| products P6 | short of serving, per-hour work cut pro rata (equal cut share) "at equal revenue per H100e" | free users first, seats and paying users served, per-hour work cut (by revenue per H100e) | the equal-share premise was cost-plus pricing (V4), removed by MK-6; Auto serves by segment revenue per H100e (revenue.ts servingSplit): here Enterprise's per-hour work is cut in full, the API's 86% | e839141 |

Not restated (a), open:

- **worktypes lint** "no player mechanism reads shareRefAt": `worldfx/revenue.ts:177` `sellerCaps` (MK-8) reads
  `shareRefAt().serving` for the rivals' serving capacity (it skips the player). The lint allows rival code only by
  directory (actors/) or a line naming the RD item that removes it; there is no RD id for the rivals session. Needs a
  decision: an allow-list entry or a tag (MARKET.md "For the rivals session" already lists it).
- **test:ui B2 ×3** "every tools-editor row shows its type and typed effect": see (b) 2; the rig's UNIT table still
  has an `effort` kind (M8 removed effort) and no form for Agent mode.

## (b) Bugs open

1. **Seat price readout is the last cell's, not the average** (revenue.ts, `DeploymentRevenue.seatPrice = o.seat`
   overwritten per sector × region; MK-9 made seat prices per cell). serving B3 fails: start Enterprise 6.7M seats ×
   $12 × 12 ≠ the $1.81B seat revenue (the average is $22.5). The Products card shows this number ("seats … at
   $X/month", marketView.ts:244). Repro: `npx tsx scripts/v2/serving.ts` (B3), or `_mk6/check.ts` seed 7 "seats $1.83B
   at $12.05/month". Trivial fix: seatPrice = seatDemand × 1e9 ÷ (seats × 12) where seats > 0, as seatCost already is.
   Not applied on purpose: any src edit changes the simulation cache key, and the cache now holds ≈ 100 cold calib
   games of this commit (≈ 60 min of machine time) that part 2 can reuse. Apply it first thing in part 2, then re-run
   serving (B3) and `_mkcp/p_b3.ts` (the probe checks seats × seat price × 12 = seat revenue per product).
2. **Agent mode's row in Add a tool shows no type and no effect** (test:ui B2 day 1 / 400 / 900: `agentMode:  |  |`;
   day 400 / 900 the effect cell reads only "on"). Every other tool row has a type chip and a typed effect. Repro:
   Products › a business product › Add a tool. Not a one-line fix (the row needs a stated effect: "sells agent-hours;
   needs a time horizon ≥ the task length"), left for the UI.

No crash, NaN or conservation failure was found: every _mk conservation check passes (MK-7 / MK-8 turned-away = sum of
destinations to 1e-16), 90 days on the day-369 save run clean (MK-6 (d), MK-7 (c)), preview = next tick in all five
MK-12 cases.

## (c) Calibration (number vs sourced target; not retuned)

| Quantity | Now | Target | Source | Likely cause |
|---|---|---|---|---|
| Leader day-1 revenue (serving A8) | $15.32B (newGame: $15.1 / 16.9 / 17.7B, seeds 7 / 2027 / 42) | $12–15B | serving.ts A8 comment; MARKET.md MK-CP row | business side priced by MK-6c (ε 0.3) and seats at the cap: MK-9 puts every leader cell at $26.4–27.4 of the $27.5 cap |
| Chat share of it (A8) | 59% | 60–75% (≈ two thirds) | same | same: the business side above, Chat plan at the $22 cap |
| Start leader margin (p − c)/p | 0.80–0.83 (rivals 0.62–0.73, DeepCent 0.17) | 0.8–0.9 (0.6–0.85 [P], elasticity bound ≥ 0.9) | research/MARKET-sources.md §3 | in range |
| Leader share of adopted hours outside China | 0.36–0.41 | ≈ 0.32 | MARKET-sources §3i (Menlo, enterprise API usage, mid-2025) | close; Menlo measures enterprise API usage only |
| 2026 revenue (worldfx F7/F11) | $48.0B (SMOKE) | $36–67B | research/22 §4 | in range |
| CY2026 non-China frontier-lab revenue | $102.1B (leader 47%) | $100–130B | research/22 §4 (A2c) | in range |
| 2027 revenue (worldfx F11) | $95.7B (SMOKE, one seed; finance SMOKE RefBot path $77.5B); 2026 $48.0B in range | $98–182B (~$140B ±30%) | V2-SPEC §7.3 F11 | prices fall faster than use grows after mid-2026: from the day-400 to the day-900 fixture the per-hour price falls API $1.91 → $0.74/h, Enterprise $2.19 → $0.67/h (S3), and Chat's plan $21.8 → $12.2/month, as MK-6c's μ_b follows the cheapest adequate cost (MARKET.md MK-6c finding: a cheap model that does every band collapses the price scale for all sellers). Passed at CP4 (pre-market). Needs the full run to confirm over seeds |
| Milestones, calib T1 ai2027 (20-seed median) SC / SAR / SIAR / ASI | 622 / 784.5 / 844 / **865** | 638 ±29 / 791 / 883 / 915 ±44 | golden (calibration.ts), CAL2 | CP4: 622 / 784.5 / 847.5 / 868.5: the market moved them by ≤ 4 d; ASI fail is CP4's (b) |
| T1 authors2026 SAR / SIAR / ASI | 1518 / 1626.5 / 1682.5 (fail ×3) | 1573 / 2151 / 2975 | golden | CP4 1520.5 / 1614 / 1666.5: already failing (calibration closed) |
| T1L ai2027 ×4, authors2026 SAR, fast SAR, slow SC | 576 / 744 / 793 / 814; 1476; 926; 2628 (fail ×7) | 638 / 791 / 883 / 915; 1573; 880; 3289 | golden | CP4 576 / 745 / 794 / 815; 1475; 931; 2614: rivals session, unchanged |
| T4 rival gaps at start | 3.3–5.0 months | 3–9 months | calib T4 | in range |
| Canary seed 2027 SC / SAR / SIAR (fixtures) | 641 / 879 / not by 900 | 638 / 791 ±44 / 883 ±44 | golden | unchanged from CP4 (same three days): the market did not move seed 2027's timeline |
| Agent-hours at the start | 0 for every seller | — (no target) | — | MK-11's Agent mode gate (horizon ≥ task length) fails for every start model; noted, not a check |

Finance (SMOKE, one seed; CP4 already had F7 valuation $0.94T, F9 FC1 / FC2 out): F7 end-2026 valuation $0.98T (target
$1–3T), F7 compute costs $24.9B (≈ $40B), F9 FC1 start marks $258B (≈ $0.5–0.65T), F9 FC2 multiple 14.5× (20–37×). These
are the pre-market list; whether the market moved them needs the full finance run.

## Already failing before the market (CP4 / pre-market master)

From quick (counts per item): data draw (CP4 b); domainref REF_OFF grep; evals EV9; finance FIN3b (CP4 52%, now 62%,
one SMOKE game); fixtures canary SAR / SIAR (2, values unchanged); hygiene registry + newGame leaderLab ×5 (6);
lint-structure; oversight decay; products P7 companion users (669M → 659M), M2, A5, A6 (4); research dud / assignment
(2); rivals R5, R8 (2); safetyideas P23; safetyresearch E1 ×3, E2 (4); serving S5, S6, A7 (3); signals (2); successor;
suites ×5; ws4 T3 ×2 (rivals session). test:ui: CP4's 13 (Products locked tools, Investigations ×2, D8 ×3 + evalGate,
E11 ×2, FIN4a, IA safetyHeader / frameworkHold, F6c, F6e). cal: all 11 (T1 ai2027 ASI, T1 authors2026 ×3, T1L ×7), see (c).

Not market, new since CP4: **ws4 E1 "no AI 2027 canon"** fails because master's model naming gives the ai2027 world
Agent-N names (E01 / E10 / E25 texts name "Agent-1-1.0"); it fails the same way on the pre-market master 336c5ed
(probe). A naming vs canon-rule decision for the designer.

## Not run, or not finished

- full tier's long suites at full size (safety, finance, worldfx, ws4, hygiene 3b, safetyrates, idle all seeds): still
  running or queued at write-up (run.ts --tier full --only …, output %TEMP%mkcpull.txt when it ends; its shell
  timeout is 2 h from 18:52). Their quick-tier SMOKE results are above.
- deep tier.

## Counts after part 1

quick's 54 failures: (a) restated and now passing 9 (serving S3 ×2, B7 ×2, D3 ×2, B6, B16; products P6; CP4's B7 day 900
(b) is among them: it was the same rig drift), (a) open 1 (worktypes lint), (b) 1 (serving B3), (c) 2 (serving A8,
worldfx F11 SMOKE), not market 1 (ws4 E1, model naming), already failing 40 (the list above: 1 + 1 + 1 + 1 + 2 + 6 + 1
+ 1 + 4 + 2 + 2 + 1 + 4 + 3 + 2 + 1 + 5 + 2). 9 + 1 + 1 + 2 + 1 + 40 = 54; 45 remain. Outside the tiers: _mk3 ×4 and
_mk6 / _mk6b (c) restated. test:ui 16: 13 already failing, 3 new (B2 Agent mode row: (b) 2, with the rig's (a) part).

Scratch: `scripts/v2/_mkcp/` keeps the shared preview helper and five probes (p_d3, p_s3, p_b6, p_p6, p_b3); a
baseline worktree at AI27-mkcp/.simcache/base (336c5ed, detached, inside the ignored cache directory) was used for the
E1 probe; remove it with `git worktree remove --force .simcache/base` when done.


## Full tier result and handoff (2026-11-24, end of the market session)

The full tier finished (`%TEMP%/mkcp/full.txt`). New since CP4 and caused by the market: **finance F11 2027 revenue
$73.3B vs ~$140B ±30 %** (RefBot, classic) and **FIN3a board confidence 39.8 vs ≥ 40** (likely a knock-on). Start
($12B run-rate) and 2026 ($48B) are in range. Everything else failing in full (F7, FIN3b, S4, ws4 T3 China, hygiene
leaderLab / unlisted systems, the UI items) was already failing at CP4 with about the same values.

Open for the next session (designer: "discuss and do in a different session"):
1. Bugs: seat price readout is the last sector's, not the average (revenue.ts `seatPrice`, one line, see (b) 1); Agent
   mode's row in Products › Add a tool shows no type / effect (UI B2).
2. Restatements: worktypes lint entry for `sellerCaps` (rivals read `shareRefAt`); UI B2 rig still lists the removed
   effort kind.
3. Diagnose F11 (2027 revenue): decompose RefBot 2027 revenue into hours × price × share by product vs pre-market master
   (336c5ed) before changing anything. Candidates: prices fall ≈ 3× day 400 → 900 under the cost-anchored price scale
   with no market-level volume response (no sourced number), slower automation since MK-5b, compute-bound rationing.
4. Designer decision (not market): ws4 E1 "no AI 2027 canon" fails because master's model naming gives the ai2027 world
   Agent-N names — keep the names and relax the rule, or change the names.
5. Cleanup: remove worktrees AI27-market, AI27-mk1..13, -mk5b, -mk5c, -mk6b, -mk6c, -mkcp (after merging mk-cp),
   C:\tmp\mk9base, AI27-mk11-base, AI27-mk13-base (each: `cmd /c rmdir <path>\node_modules` first where it is a
   junction); untracked scratch files listed in the task reports.

Branch `mk-cp` (fixtures regenerated at SCHEMA_REV 110, check restatements, this report; no src changes) is not yet
merged to master.
