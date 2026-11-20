// Event catalog: rival decisions (V2-SPEC §4.2: E32). Owner: WS4. Subjects are ACTIVE rivals only (E2);
// comparisons use the player's best INTERNAL version (E3).
//
// E32 "Merger offer" (FIN3c, FINANCE-V3 §9): a private rival in distress (rivals.ts rivalFinanceQ requests it the
// quarter its cash runs out) is for sale at half its valuation, for cash or your stock. You get 70% of its staff (and
// its compute, as before) and take on its contracts and debt (finance/acquire.ts); antitrust scrutiny follows; the board
// votes on the merger. Declined, it goes to a big-tech rival next quarter if it is still failing, or shuts down
// (rivals.ts, left as is for FIN5b's license-and-hire exit).
import { activeRivals } from '../../models/labs';
import type { CostLine, EventDefV2, GameStateV2, RivalLab, SystemCtx } from '../../types';
import { morale, scrutiny } from '../../actors/fx';
import { deactivateRival, postureOf } from '../../actors/rivals';
import { ws4 } from '../../actors/state';
import { changeHeads } from '../../departments/teams';
import { acquireBlock, acquireTerms, acquireVotes, forceLines, obligationLines, payForRival, paymentLines, sellsControl, shownVote, type PayWith } from '../../finance/acquire';
import { L, activeLab, ch, ev, labName, requestOnly } from '../kit';

/** Share of a bought lab's staff that joins (kept from E32). */
export const MERGER_STAFF = 0.7;
const SCRUTINY = 20;

/** The lab on offer: the pending decision's, else (catalog lints) the first private rival in distress. */
function target(s: GameStateV2, d?: Record<string, number | string>): RivalLab | undefined {
  if (d?.lab !== undefined) return activeLab(s, d.lab);
  const p = s.events.pending.find((x) => x.id === 'E32');
  if (p) return activeLab(s, p.data.lab);
  return activeRivals(s).find((r) => r.finance.distress && r.finance.valuation > 0);
}

const staffOf = (r: RivalLab) => ({ cap: Math.round(r.core.staff.cap * MERGER_STAFF), saf: Math.round(r.core.staff.saf * MERGER_STAFF) });

function buyPreview(pay: PayWith) {
  return (s: GameStateV2, d?: Record<string, number | string>) => {
    const r = target(s, d);
    if (!r) return { costs: [L(pay === 'cash' ? 'cash' : 'dilution', 0, 'half its valuation'), L('scrutiny', SCRUTINY, 'antitrust')], gains: [L('staffTime', 0, `${Math.round(MERGER_STAFF * 100)}% of their staff`)], exposure: [L('cash', 0, 'its contracts and debt')] };
    const t = acquireTerms(s, r);
    const st = staffOf(r);
    const costs: CostLine[] = [...paymentLines(s, t, pay), L('scrutiny', SCRUTINY, 'antitrust review'), ...forceLines(acquireVotes(s, t, pay))];
    const gains: CostLine[] = [L('staffTime', st.cap + st.saf, `${st.cap} capabilities + ${st.saf} safety staff (${Math.round(MERGER_STAFF * 100)}% of theirs)`), L('talent', 3, 'a bigger lab draws talent')];
    return { costs, gains, exposure: [...obligationLines(s, t.obligations), L('morale', -3, 'integration and culture blend')] };
  };
}

function buyApply(pay: PayWith) {
  return (s: GameStateV2, ctx: SystemCtx, d: Record<string, number | string>) => {
    const r = target(s, d);
    if (!r) return;
    const t = acquireTerms(s, r);
    const sold = sellsControl(t, pay);
    const no = payForRival(s, ctx, t, pay);
    if (no) {
      ctx.log('finance', `The ${r.core.name} deal did not go through: ${no}.`, 2);
      return;
    }
    if (sold) ws4(s).soldControl = true; // its holders now control the company (the 'acquired' ending)
    ws4(s).absorbedCompute += r.core.computeOnline;
    const st = staffOf(r);
    changeHeads(s, 'cap', st.cap);
    changeHeads(s, 'saf', st.saf);
    scrutiny(ctx, SCRUTINY, 'E32 antitrust');
    ctx.bump('relations.talentPull', 3, 'E32 acquisition');
    // Culture: their posture blends into morale (safety labs lift safety morale, mavericks lower it).
    const p = postureOf(s, r.core.id);
    ctx.bump('morale.safety', (p.safetyInvestment - 0.4) * 10, 'E32 culture blend');
    morale(ctx, -3, 'E32 integration');
    deactivateRival(s, ctx, r.core.id, 'merged', 'player');
  };
}

const buyAvailable = (pay: PayWith) => (s: GameStateV2, d?: Record<string, number | string>): true | string => {
  const r = target(s, d);
  if (!r) return 'The offer is off';
  return acquireBlock(s, acquireTerms(s, r), pay) ?? true;
};
const buyVote = (pay: PayWith) => (s: GameStateV2, d?: Record<string, number | string>) => {
  const r = target(s, d);
  return r ? shownVote(acquireVotes(s, acquireTerms(s, r), pay)) : undefined;
};

/** The big-tech lab that would absorb a failing rival next quarter (rivals.ts rivalFinanceQ), if any. */
const bigTechBuyer = (s: GameStateV2, r?: RivalLab) => activeRivals(s).find((x) => x.archetype === 'bigtech' && x.core.id !== r?.core.id);

export const RIVALS_EVENTS: EventDefV2[] = [
  ev({
    id: 'E32', title: 'Merger offer', icon: 'rival', crisis: false, cooldown: 365, deadlineDays: 30, defaultChoice: 2,
    // FIN3c: offered only when a private rival runs out of money (requested by rivalFinanceQ), never for your lead.
    when: requestOnly,
    text: (s, d) => {
      const r = activeLab(s, d.lab);
      const price = r ? acquireTerms(s, r).price : 0;
      return `${labName(s, d.lab)} is out of money and open to a buyer${price > 0 ? ` at $${price.toFixed(0)}B, half its valuation` : ''}. You would take on its contracts and debt; antitrust regulators will look closely.`;
    },
    choices: [
      ch('Pay cash', ['race', 'acquire'], buyPreview('cash'), buyApply('cash'), buyAvailable('cash'), buyVote('cash')),
      ch('Pay in stock', ['race', 'acquire'], buyPreview('stock'), buyApply('stock'), buyAvailable('stock'), buyVote('stock')),
      ch('Decline', ['decline'], (s, d) => {
        const r = target(s, d);
        const b = bigTechBuyer(s, r);
        return { costs: [b ? L('leadDays', 30, `estimate: ${b.core.name} likely absorbs it next quarter`) : L('staffTime', 0, 'it shuts down; its staff scatter')], gains: [], exposure: [] };
      }, () => {}),
    ],
  }),
];
