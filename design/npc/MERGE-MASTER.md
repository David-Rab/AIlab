# Merge of master (ea5838b) into npc (c96fa82), branch `npc-merge`

Lead's brief, 2026-11-27, with the designer's change: every master change since 6bf46bc that touches the rivals, NPC
labs, China's lab or the leader lab is judged against NPC-LABS.md §2 (principles 2, 4, 5, 7 above all) as **drop** (it only
served the old simulation), **re-express** (on the NPC model, simply) or **designer** (a design choice: not decided here).
No heavy tests were run (designer's session rule).

**State: committed.** Two items went to the designer (D1, D2); the decisions (2026-11-27, §1b) are applied in the merge.

## 1. Master changes that touch NPC labs (conflicting or not)

Found by grepping master's diff 6bf46bc..master (src, scripts, balance) for rivals, s.rivals, otherLab, activeRivals,
china.lab, labOf, rival, leader, poach, archetype, meters, posture, employer, tasteHire.

| # | Master commit / change | What it did to rivals | Verdict | What I did |
|---|---|---|---|---|
| 1 | 2d4c509f teams as whole chunks: C4 Poach (actors/actions.ts) | The rival loses the heads that actually moved (`changeHeads` rounds to whole teams) | re-express | The §5 Poach-in shock by the heads that move (D1 rule); the preview reads the same count through the new pure `headsMoved` (departments/teams.ts; `changeHeads` now applies the same plan); the rival's `staff.cap` falls by those heads |
| 2 | 2d4c509f: E16 Talent raid "Let go" (events/catalog/company.ts) | The rival gains the heads that actually left; `addRivalKnowledge` (deleted by npc) | re-express | The let-go shock by the heads that leave (D1 rule), preview through `headsMoved`; the rival's `staff.cap` grows by them; `poachLeakG` / `addRivalKnowledge` stay deleted |
| 3 | 21d2f531 L13/L14, then 2d4c509f: weekly premium poaching, `poachFromRivals` (departments/market.ts) | With a pay premium, a share of the player's weekly hires is taken from the active rivals' `staff.cap/saf` (never China) | designer (D1): **(b)** | Each rival takes the Poach-in shock by its capabilities heads moved (the shock's measure is the share of capabilities staff), then loses its heads. New pure `poachSplit` (where the heads come from) and `poachFallbackDays`; the premium preview gains "days the rivals fall back in a year" (a year of this week's poached hires at the new premium, through the same functions) |
| 4 | 21d2f531 L14: `otherLabHeads` (departments/market.ts), `startMarket` (core/init.ts) | NPC and China heads count in the labour market's E (wage, matching); shown on LAB › People as "Other labs employ" | re-express (designer: the design) | NPC labs are background demand: heads on the reference headcount path scaled by start size, counted in E, never rationed, not driving progress. `startMarket(s)` added to npc's init after the NPC labs' first orders. The PLACEHOLDER comments in departments/market.ts now state this as the design |
| 5 | b481c805 L11: star employers at the start (`initialLabour`, `STAR_EMPLOYER0`, `STAR_LAB_ORDER`) | Stars' employer shares (OpenAI 0.20, Google 0.24, Meta 0.12, Microsoft 0.04, outside, China) mapped by rank: player = OpenAI's share, then `s.rivals` in order | designer (D2): **NPC labs hold no stars** | The player holds round(0.20 × 37) = 7 (OpenAI's share, decision 4); every other star is in one outside group. `Star.employer` is 'player' or 'outside'; `STAR_LAB_ORDER`, the rank apportionment and `initialLabour`'s rival-ids argument removed; the star poach premium (`premiumOf`, `askingPay`, `DEFAULT_POACH_STEP`), China's not-hirable stars and the employer labels removed from engine and LAB › People (stars hire at their pay, button "Hire"); glossary and scripts (stars.ts, labourinit.ts) follow |
| 6 | 372f5ece L17 / 7ce179cd L18: poaching a rival's star costs that rival's cooperation (`STAR_POACH_COOPERATION` −20, writes `r.meters.cooperation`; UI tooltips, glossary) | Writes the rival `cooperation` meter | drop | npc deleted the meter (N7, "cooperation: done"; nothing read it) and N7 already removed the old star hire's "trust with rivals" cost. Removed the write, the constant, its registry entry, the preview cost line, the two LabTabs tooltip lines, the glossary clause, and the script check (then D2 removed rival-held stars altogether). `hireStar` lost its unused state argument |
| 7 | 372f5ece L17: old Star hire action (and its rival cooperation write) replaced by STAR_ACTIONS | Removed a cooperation write | (same as npc) | Took master's STAR_ACTIONS (models/actions.ts); npc's starHire / STAR_HIRE path gone with it (data/v2/teams.ts, registry STAR_HIRE / QUALITY / TEAM_COST_M / HIRING_BASE / ATTRITION_BASE: master's removal) |
| 8 | 372f5ece L17: `tasteHire` removed from every lab core | Rival / China / leader cores lost `tasteHire: 1` | re-express | Removed it from npc's NPC lab builder (npc/lab.ts `initialNpcLab`); npc's actors/rivals.ts and china.ts versions kept (they no longer build labs) |
| 9 | cedf8dfc L15: team sizes 100/50/20, sourced leader start (1,930 cap staff) | Player only; the hygiene leader-lab check lost its `tasteHire` clause | drop (NPC side) | Player side taken. NPC staff keep their one typical ratio (npc/lab.ts STAFF_PER_H100E from calibration H_REF_BASE, unchanged on master): principle 2, a player re-tune does not move NPC labs. hygiene.ts `leaderChecks` stays deleted (npc) |
| 10 | f199d70c L4: P24 / Recurrent start from the pretraining stock; `linePoolAt` "rivals: the mean start pool" | Comments say rivals read line pools; no NPC code reads them on npc | drop | Kept master's player logic; removed the stale "rivals" wording in models/research.ts `linePoolAt` and data/v2/tree.ts |
| 11 | d9201dca L12: new `labour` RNG stream | None (player's market) | n/a | Added `labour: 'WS1'` to hygiene.ts STREAM_OWNER (lost with npc's side of that conflict) |
| 12 | DC-3 / DC-6 / DC-2 (data-centre redesign): sites, stored-chip decay removed, world waits | Rivals and China still grow compute through the chip market (marketQ); the waits use one "everyone else" row, no per-lab split (D-11) | n/a | Nothing NPC-specific; npc's compute rule (2.25×/yr through the chip market) is untouched |
| 13 | d5ac5836 / 469bea29 / master save.ts: migrations below 113 deleted (incl. 107 → 108 rival tools by archetype, 108 → 109 rival price margins) | Old migration steps read `archetype` | drop | npc has no migrations at all (N12). SCHEMA_REV = 116 (master is at 115, npc at 114; max + 1), MIN_SCHEMA_REV = SCHEMA_REV |
| 14 | New master scripts: poach.ts, stars.ts, linestart.ts | Use `s.rivals` staff; linestart used `setup.leaderLab` | re-express | linestart.ts: `leaderLab` dropped (setup has no such field on npc); stars.ts: see #6; poach.ts compiles as is (NPC labs have `core.staff`) |

## 1b. Designer decisions (2026-11-27)

1. **NPC labs are background demand only** in the labour market: their heads follow the reference headcount path scaled by
   each lab's start size (growLabStaff), count in E (so they raise wages for everyone), are never rationed by the pool and
   don't drive their progress. China's lab: counted in E, never poached.
2. **D1 = (b), one rule for people moving.** Any heads moving from an NPC lab to the player (C4, the weekly premium poach
   share, anything else) take the poach-in shock (npc/shocks.ts) by the heads moved, with the same function in the
   previews; heads moving to an NPC lab (E16 let go) take the let-go shock. One function per direction.
3. **D2: NPC labs hold no stars.** Every star not at the player at the start sits in one outside group; hiring a star takes
   it from that group and affects no NPC lab.

Unit check (scripts/v2/npcShocks.ts, direct calls, all pass): C4's d change = poachInDays of the heads that move = its
preview line; premium poaching moves each rival by poachInDays of its capabilities heads moved, the sum equals
poachFallbackDays, China untouched; the premium preview line = poachFallbackDays of a year of poached hires; E16's d change
= letGoDays of the heads that leave = its preview; every star is the player's or outside and a star hire leaves every NPC
lab unchanged. A constructed case to note for balance: every rival 120 days ahead of the player, four open research-engineer
teams, +50% premium previews about 73 days of rival fallback a year (the shock only moves rivals ahead of the player).

## 2. The conflicts and how each was resolved

| File | Resolution |
|---|---|
| scripts/v2/fixtures/*.json (5) | npc's files. **Stale on both sides; must be regenerated after the merge** (`npx tsx scripts/v2/fixtures.ts --write`, heavy, needs the designer's go). Until then scripts loading them throw OLD_SAVE_MESSAGE (SCHEMA_REV 116) |
| balance/params/market.ts | Master's removal of QUALITY / TEAM_COST_M / HIRING_BASE / ATTRITION_BASE / STAR_HIRE (npc had only edited STAR_HIRE) |
| src/data/v2/teams.ts | Master (the same constants retired) |
| src/data/v2/deals.ts | Master's import line (no `Site`) plus npc's `NpcKindId` import (AFFILIATE_KIND) |
| scripts/v2/hygiene.ts | npc (the leader-lab check stays deleted); `labour` stream owner added (#11) |
| src/engine/v2/actors/actions.ts | #1 |
| src/engine/v2/events/catalog/company.ts | #2 |
| src/engine/v2/actors/rivals.ts, china.ts | npc (the old builders stay deleted; master's only edit there was `tasteHire`, #8) |
| src/engine/v2/core/init.ts | Master's labour imports (`stream`, labourMarket, ces) without the unused `hash32`; `labour: initialLabour(...)` with npc's knowledge line (no `sharedTechniquePool`); npc's NPC first orders and player-only readout, plus master's `startMarket(s)` |
| src/engine/v2/core/save.ts | npc (no migrations); SCHEMA_REV 116 |
| src/engine/v2/models/actions.ts | Master's `...STAR_ACTIONS` |
| src/ui/v2/panels/LabTabs.tsx | Master (the old star box is gone; its stars panel replaces it); cooperation lines removed (#6) |
| src/ui/v2/setup/Setup.tsx | npc's `REALISTIC_CAST` import plus master's `TEAM_SIZE` import |

## 3. Outside the conflicts

- **Registry:** master's registry still held 32 entries for constants the data-centre redesign deleted (SITE_PATHS,
  BUILD_Q, LEASE, TRANSFORMER, NETWORK_PER_GW, COMMUNITY.upfront/blockMult, MARKET.inventoryDecayQ, mod.power.* and
  mod.sites.* anchors, core.starts.LEASE_PER_GW_Y / BROWNFIELD_PER_GW): registry:lint failed with 32 errors on the merged
  tree. Removed (rule 5: entries only for constants that exist), plus `STAR_POACH_COOPERATION` (#6). Now 0 errors.
- **Pre-existing master script errors** (scripts tsconfig, not from this merge; master's own scripts read fields master's
  src removed): research.ts:348 and safetyresearch.ts:33/40/46 (`Team.quality`), tastecurve.ts:22 (`QUALITY_TASTE_SD`;
  this replaces the known unused-`tasteSigma` error). Left alone (not this concern).
- Deletion grep (brief rule 6) over src: only `leaderLab` hits, all pre-existing on npc and justified: `StartDef.leaderLab`
  (data/v2/starts.ts: whether the frontier-leader NPC is in the cast for that start; Setup.tsx text) and one stale comment
  in compute/market.ts:125.

## 4. Checks run (after the designer's decisions)

`npx tsc --noEmit -p .` clean. `npx tsc --noEmit -p scripts/v2/tsconfig.json`: only the pre-existing master errors above.
`npm run registry:lint`: 0 errors. `npm run build`: ok. npcData, npcReference, npcSetup, npcPublic, npcRisk, npcEndings,
npcShocks (with the new checks), npcMoney2, npcMisalignment: all pass.

## 5. To run afterwards (heavy; the lead asks the designer)

1. Fixtures: `npx tsx scripts/v2/fixtures.ts --write`.
2. Master's labour scripts on the NPC labs: `poach.ts` (its rival-staff checks now also move the rivals' lags), `stars.ts`, `labourinit.ts`, `linestart.ts`, plus the labour-round tests on master
   (teams / market scripts listed in design/BAL-TASKS.md).
3. Whole-game pass: `calib.ts --smoke`, `hygiene.ts --no-perf` (determinism, stream isolation incl. the new `labour`
   stream, save round trip), `ws4.ts`, `finance.ts`, `serving.ts`, `npcLabs.ts`, `npcMarket.ts`, `lint-tradeoffs.ts`.
4. `npm run test:ui` (uitest.mjs auto-merged from both sides; both edited the LAB › People and setup sections).
