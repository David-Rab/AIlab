# G4 report: finance.ts, worldfx.ts (branch ta-g4)

## worldfx.ts (worldfx-refplay.ts deleted; refGame() inlined)
| check | class | action | OPEN.md row (proposed) |
|---|---|---|---|
| F7/F11 2026 revenue $7.1B vs 36-67 | CAL-TARGET | KNOWN | Balance: outside-world 2026 revenue (player revenue ~5x under band) |
| F11 2027 revenue (full only; smoke $3.4B->skipped) | CAL-TARGET | KNOWN | same row, 2027 |
| Late 2026 SOFT youth employment / hire / youth U | CAL-TARGET | KNOWN | Balance: youth employment 2026 |
| Jul 2027 AI-friend share 6.5-6.9% vs 10 +-3 | CAL-TARGET | KNOWN | Balance: AI-friend share |
| A2c tokens/day x2.5 vs x4.6-20 | CAL-TARGET | KNOWN | Balance: tokens/day growth 2026 |
| W4 exposed 22-25 -11.5% vs -19 +-5 pp | CAL-TARGET | KNOWN | Balance: exposed 22-25 |
| headlines >= 10 distinct | TEST-BUG (horizon) | smoke ends Jan 2027 (9 fire): >= 6 in smoke, >= 10 full | - |
Cost: quick 130 CPU-s -> ~30 s wall (one 550-day game + 90 idle ticks); 2027 checks print SMOKE (skipped, game ends 2026).
Full (not run): 1 game + 4 timing games of 915 days (horizon 2028-01-15, was 2028-04-01) = ~3.7 CPU-min (was ~5.5 incl. 19 seeds).
Timing seeds 19 -> 4 (5 in all): window +-92 d, per-seed p10-p90 90-170 d (sd 35-66 d), median se = 1.25*66/sqrt(5) = 37 d.
Removed: duplicate tl-central game (W4 reads c.at), tl-fast INFO game, refplay stub. If 3 CPU-min is firm, 3 timing seeds = ~3 min.

## finance.ts
| check | class | action |
|---|---|---|
| FIN4a tranche buys shares ... stops at 15% | TEST-BUG | tranches now partly lapse at the cap: landed in (0, sum], stake <= 15% |
| FIN4b exclusivity +25% (Azimuth 15.0 -> 15.6) | TEST-BUG | day-400 offer is the 3x$5B floor and the 15% cap leaves $15.6B: bump checked from a state with room (stake 0, V $300B) |
| FIN4b no IP access without lab / IP +20% / PBC+trust | STALE | day400 now has a real bigtech rival (Tarnwick) and only Azimuth is `inHouse`; withLabs() removed, lab = rivals[1], Northwind has none, rescue test uses Azimuth |
| FIN4b signed IP access moves lag | TEST-BUG | pullDays is 0 when the lab is level/ahead; lab lag set behind |
| FIN4r H2 promise weight < 1% | STALE | weight = 0.1/7.7 = 1.3%: < 5% |
| FIN4r H3 distress down round >= $20B | TEST-BUG | size = max(10, min(9% V, 3 burn)); V raised so a $20B+ round is possible |
| FIN5b rival governance by kind | STALE | kind 'maverick' is now 'racer' |
| FIN5b bust: rival recovers next quarter | STALE | spec FINANCE-V3 §12: a distressed rival exits by license-and-hire; test checks it exits |
| FIN6a aggressive pitch | TEST-BUG | raiseQuote with ask $5B > ceiling prices the over-ask in; ask = 0.9 x ceiling |
| FIN5a RefBot equity raised (2025 H2 8.1B, 2026 36.2B) | CAL-TARGET | KNOWN; row: Balance: RefBot equity raised a year (full tier; could not be run in quick now) |
Removed: F10 400-site Monte-Carlo -> constructed (oppositionOdds 9%/27%, siteBuildQ 7); F11 duplicate start/2027 revenue
(worldfx has it); E37 "is gone" one-off; F1-F3/F6 long run to 2028 -> seed 1 of the 4-seed set to end-2027 (F3 label "through 2027");
action loop 100 -> 8 ticks; idle sims 200/300/400 -> 100/100/150 days.
Moved to full only (bot games / long waits): all F1-F9 bot checks, FIN2/3a/3b/4a/4b/5a/5b/6a RefBot checks, FIN5c mixed bot, FIN4r M3 (6-year site wait: rewrite constructed from siteSchedule, TODO), H1 year-of-ticks verification.
Seeds: RefBot 12 -> 4 (34 s each; medians vs bands F7 +-20-25%, valuation x3 wide); bare / capex2x 12 -> 6 and stop at first distress (day 92: ~2 s each).
Cost: quick 407 s + 2 shards (~185 s each) -> 144 checks, ~70 s wall, 0 failures, no shards. Goal 30 s NOT reached: remaining is
constructed FIN sections that tick day-400 / bigtech states (FIN5c ~15 s, FIN1-3 idle ticks ~20 s).
Full: NOT run. Estimate ~7 CPU-min (was ~20 min with 12 seeds): asks the lead. Cheapest further cuts: 3 RefBot seeds (-34 s),
shock runs to be constructed (-1 min), FIN5c mixed bot to a constructed review (-34 s).
Full-only checks have not been executed since the edit (smokeCheck -> check in full): expect that some may go red (F2/F7/F9 values unknown).

## run.ts / lib.ts proposals
- finance quick: no shards (drop `shards.quick: 2`); worldfx full shards 4 -> 2; finance full shards 3 -> 4 (RefBot seeds are the unit). Budgets: finance quick ~90 CPU-s (justify: ~144 constructed checks), full ~7 CPU-min; worldfx quick ~35 CPU-s, full ~4 CPU-min.
- worldfx-refplay.ts is deleted: remove it from any `files` lists/lint if referenced.
## Questions
- FIN4b: affiliatedLab returns the first active bigtech rival for any inHouse partner; fine while only Azimuth is in-house.
