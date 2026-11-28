// Event catalog: partner decisions (C7b, CORPORATE.md §5.4). Owner: WS4 (decision), WS3 (the deal).
//
// E33 "Partner renewal": a partner's deal reached its end (finance/deals.ts partnerMonthly requests it once per ended
// deal). The renewal is a fresh deal of the same supply on today's terms: its equity follows how much it values you now,
// and its partner discount is shortened by your dependence on it (the share of your compute it supplies). Renewing signs
// it through the normal deal flow (its votes and checks); letting it lapse ends the partnership.
import { dealPreview } from '../../finance/actions';
import { dealVote, dealVotes, partnerBlocker, partnerTerms, renewalChoice, signPartner } from '../../finance/deals';
import { interestWords } from '../../finance/partnerInterest';
import type { GameStateV2, PartnerSupply, SystemCtx } from '../../types';
import { L, ch, ev, requestOnly } from '../kit';

type Data = Record<string, number | string> | undefined;
const choiceOf = (d: Data) => renewalChoice((d?.supply as PartnerSupply) ?? 'cloud', Number(d?.dep ?? 0));
const who = (s: GameStateV2, d: Data) => String(d?.partner ?? s.events.pending.find((p) => p.id === 'E33')?.data.partner ?? 'Northwind Cloud');

export const PARTNER_EVENTS = [
  ev({
    id: 'E33', title: 'Partner renewal', icon: 'finance', crisis: false, cooldown: 1, deadlineDays: 60, defaultChoice: 1,
    // Only requested by finance/deals.ts partnerMonthly, once per ended deal; never by a predicate.
    when: requestOnly,
    text: (s, d) => `Your deal with ${d.partner} has ended. ${interestWords(s, String(d.partner))}. It offers to renew on today's terms${Number(d.dep) > 0 ? `; it supplies ${Math.round(Number(d.dep) * 100)}% of your compute, so it gives up that share of its discount` : ''}. If you let it lapse, the partnership ends.`,
    choices: [
      ch('Renew', ['finance', 'partner'],
        (s, d) => dealPreview(s, partnerTerms(s, who(s, d), choiceOf(d))),
        (s: GameStateV2, ctx: SystemCtx, d) => {
          const p = who(s, d);
          const err = signPartner(s, ctx, p, choiceOf(d));
          if (err) ctx.log('finance', `The ${p} renewal did not go through: ${err}.`, 2);
        },
        (s, d) => partnerBlocker(s, who(s, d), choiceOf(d).supply) ?? true,
        (s, d) => dealVote(dealVotes(s, partnerTerms(s, who(s, d), choiceOf(d))))),
      ch('Let it lapse', ['decline'], () => ({ costs: [L('staffTime', 0, 'the partnership ends; its capacity and supply end with the contracts you hold')], gains: [], exposure: [] }), () => {}),
    ],
  }),
];
