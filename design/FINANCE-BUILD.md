# Finance v3 build plan (phase details)

Spec: design/FINANCE-V3.md (approved 2026-11-19). User: "go ahead on all stages" (2026-11-19).
Branch `finance-v3`, worktree `../AI27-finance3`, based on master 2ef72a9. Model v3 is being built in parallel on
`model-v3` (`../AI27-model3`) by another session: **never touch that worktree or the main checkout `../AI27`.**

## Rules for every phase

1. Work only in `C:\Users\david\Documents\projects\AI27-finance3`.
2. Read FINANCE-V3.md (the whole spec) and this file before coding. The spec wins; if it is ambiguous or wrong in
   practice, choose the simplest reading that keeps its principles (§0) and record it in the phase's notes below.
3. **Contained:** finance reaches the rest of the game only through cash, the charter release block and ouster. No
   new effects on staff or morale.
4. **V3 seams.** Finance reads model-v3-owned quantities only through `src/engine/v2/finance/observe.ts` (created in
   FIN1, extended later): `publicLevel(s, lab)`, `servingEconomics(s, lab)`, `computeSecured(s, lab)`,
   `revenueRun(s, lab)`. No other finance file reads models/, products/ or worldfx/ internals directly.
5. New mechanisms in finance-owned files. Rival finance moves to `finance/rivalFinance.ts` (FIN5), with a one-line
   call from `actors/rivals.ts`.
6. Every number from the spec keeps its tag in a comment ([R15], [R21], [D], [fit]).
7. Action ids that are merged away are **removed**, and every caller (bots in `finance/plan.ts` and `bots/`, UI
   panels, `scripts/v2/*.ts`, `scripts/v2/uitest.mjs`, lint allow-lists) is updated. No aliases.
8. State changes: bump `SCHEMA_REV` in `core/save.ts` with a migration (or a documented schema break if migration is
   meaningless; saves from older builds may refuse to load).
9. UI for each phase's mechanics is built in that phase, minimal but correct, following the good-ui skill
   (`~/.claude/skills/good-ui/SKILL.md`; read it before UI work). FIN6 does the polish pass.
10. Done = `npm run typecheck` clean, `npm run test:v2` green (tests whose meaning changed are rewritten, not deleted
    silently: say which and why), `npm run test:ui` green for phases with UI, a PROGRESS.md row (FIN rows, same style
    as the R/J rows), phase notes appended below, one commit (or a few) on `finance-v3` ending with
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
11. Calibration on today's engine: run the finance and bot checks (`scripts/v2/finance.ts`, `scripts/v2/bots.ts`)
    and record the before → after numbers that matter for the phase in the notes. Full calibration is FIN6.
12. Bots must keep working through every phase: update `finance/plan.ts` (finance autopilot) to the new actions so the
    reference bot still plays a sensible CEO.

## FIN1 Debt, rating, capex payment, contracts, community packages (spec §3, §4, §5, §10 rows)

- `finance/observe.ts` with the four selectors (bridges to today's engine; economics bridge = serving revenue vs
  serving H100e × owned/cloud cost per H100e).
- Debt (§3): credit line sized by valuation (2–4%, cap $15B) with the ⅓-of-line liquidity covenant, no self-upsizing;
  chip-backed loan unchanged; bonds only with positive trailing operating cash flow, ≤ 3× it. Rating z from cash flow,
  liquidity cover, leverage, distress (no assumed backlog).
- Capex (§4): site payment options cash / lease-SPV / (chips: chip loan). Lease = funded × CRF(r by rating, n = 15 y
  sites, 5 y chips), ledger kind for leases, residual-value guarantee as a contingent liability recorded on the site;
  unavailable below B. Remove the free SPV path, `spv` deal template use for sites, and the mega-JV.
- Contracts (§5): one Buy chips action (firmness × term; replaces cmp.orderStandard / orderLTA / orderSpot) and one
  Rent compute action (term × firm/cancellable; replaces cmp.cloudContract / cmp.spotRental; neocloud = a provider).
  Firm price follows the expected market path per quarter × (1 − firm discount); ledger payments follow that path.
  Firm contracts get rationing priority. Remove cmp.fundSupplier.
- Community (§4): upfront per-site package (≈3% capex, lowers block odds) with a company default policy; merge F1
  and cmp.communityPackage into it. E27 gets the large reactive package (≈15% capex + ~2 q delay, odds by opposition);
  relocate and sue stay.
- UI: payment options and total-cost comparison on the site build card; Buy chips / Rent compute cards on Compute;
  debt card shows capacity and why; rating with its terms.

## FIN2 Raises, thesis, stacking promises, credibility, IPO, What we owe (spec §2, §11 What we owe)

- Raise card: amount, milestone type (capability / scale / adoption), pitch (conservative ×0.85 / base / aggressive
  ×1.2 needing Credible+). Targets from the chosen metric's current trend extrapolated 12 months (via observe.ts).
- Promises stack, weight = amount ÷ trailing-year raised; judged at their own deadlines; credibility 0–100 ladder and
  board-mood deltas per §2.4. Start credibility by start type.
- Remove the revenue-based annual cap (k_Y) and the revenue plan (+15%/q) from boardQ.
- Down round: keep mood −15 and anti-dilution; **remove staff attrition**. Repriced flow kept.
- IPO as its own action (one-time, window open, healthy): ≤5% dilution + one-time public pool, listing independent,
  dual-class option (founder control kept, gov ×0.95). After listing, bonds follow §3 rules.
- `finance/owe.ts`: one selector listing every obligation (promises with progress / needed-by-now / days left,
  tranche conditions, covenants with headroom, contingent liabilities: RVGs, litigation from D3). Finance "What we
  owe" card reads it; one Watch alert when a promise turns behind or a covenant nears.
- Credibility multiplies the current valuation mark as an interim (FIN5 moves it into the share).

## FIN3 Board, acquisitions, events (spec §7, §8, §9, §10)

- Charter rights (§7.2): nonprofit-PBC safety committee blocks releasing a model flagged by your safety evals (wire
  into the release/deploy path; make `safetyCommitteeVeto` real); PBC + trust approval for sale of control and for
  transferring a capability-threshold model (a visible vote by mission seats); founder override at a mood cost; legacy
  nonprofit ouster odds ×2.
- Major decisions (§7.3): deterministic, visible seat-by-seat votes (no `rng` in approval). List: sale of control,
  merger/acquisition, down round, rescue, new firm commitments or debt above 3× revenue. Remove the dilution vote and
  the 20%-of-revenue debt vote; operating decisions never voted.
- Mood (§7.4): named sources × seat-kind weights; reversion to 60; remove safety-grade bonus.
- Low confidence (§7.5): "Give the critics a seat" action (below 40); ouster vote visible; remove staff-revolt
  reinstatement; drop E37 (and its bot handling).
- Distress (§8): remove the morale hit.
- Acquisitions (§9): rebuild E32 (trigger: a rival in distress; price = valuation × ~0.5; pay cash or stock; take on
  its commitments and debt; antitrust; board vote). E22 absorbed obligations follow the same rule.
- UI: Board card (seats, stances, charter rights, mood with sources, ouster status, the critics' seat action), vote
  preview on every major decision.

## FIN4 Strategic partners (spec §6)

- One partner offer flow replaces seekPartner / acceptDeal / declineDeal and the 8 templates: kinds hyperscaler,
  chip vendor, sovereign. Hyperscaler: non-voting equity tranches capped 15% + cloud/custom chips at a discount with
  priority, take-or-pay; strings exclusivity (optional, more money), revenue share, IP access. Chip vendor: money per
  GW deployed + priority, buy its chips. Sovereign: passive equity + political cost, no site.
- Up to 3 partners; exclusivity blocks competitors; partners anchor one lab (rivals compete).
- IP access: the partner's affiliated rival lab closes ~10%/yr of your capability lead (via the rivals interface).
- No hyperscaler board seats. Rescue kept (distress). Tranche conditions: gw, revenue, ipo, recapitalisation.
- Existing start states (Northwind legacy stake, start-type strategic holders) migrate to the new deal records.
- UI: Partners section with each partner's terms, strings and exclusivity conflicts.

## FIN5 Valuation and rivals (spec §1, §12, §13)

- Sector value S_t (κ_S, α, Φ(L_frontier), mood) and share softmax over private labs with the four drivers via
  observe.ts, credibility and governance factor. Remove the narrative premium N and the old formula; pool = π·S_t.
- Rivals in the same split (`finance/rivalFinance.ts`): valuation marked quarterly; raise at it when cash < half a
  year of spend (d_max, pool); trailing private lab in distress is license-and-hired by a big-tech rival (team +
  licence + compute to the buyer), bankruptcy only without a buyer.
- Big-tech division (§13): parent annual budget judged against the parent's goals (promise mechanism set by the
  parent), cut after misses; overspend covered but costs parent confidence; replaces the runway distress verdict for
  divisions (fixes JANK-AUDIT F2).
- Story card UI (sector, mood, share, four drivers, credibility).

## FIN6 Calibration, UI pass, review (spec §11, §14)

- Fit [fit] parameters to FC1–FC7 on today's engine (record that a refit is due after model-v3 V4 and V7).
- Reference bot and other bots: fewer, larger rounds; use chip loans/leases and firm contracts; check distress share
  and FC7.
- UI pass on the Finance tab (Story · Raise · What we owe · Board · Cash) and the payment/contract cards, against the
  good-ui skill; uitest updated; tooltips for every new term (glossary).
- Self-review of the whole branch for leftovers of removed mechanisms (grep for removed ids, `narrative`, `kY`,
  `revenuePlan`, `megaJV`, `spv` template, E37) and dead code.
- PROGRESS row; report what needs refitting after model-v3.

## Phase notes

(Each phase appends its notes here: choices made, deviations from the spec, numbers before → after, test changes.)
