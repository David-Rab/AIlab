// Finance decision events (V2-SPEC §3.7.4–3.7.6, §4.2): E02 recapitalisation, E03/E04 partner offers, E26 distress
// menu. Owner: WS3 (content). WS4 owns the catalog and the director: add `...FINANCE_EVENTS` to
// events/catalog/company.ts. Choices reuse the finance ActionDefs, so previews and effects match the Finance panel.
import type { ChoiceV2, EventDefV2, GameStateV2 } from '../types';
import { dealPreview, FINANCE_ACTIONS } from './actions';
import { dealTerms, partnerFor } from './deals';

const action = (id: string) => {
  const a = FINANCE_ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`finance event: unknown action ${id}`);
  return a;
};

/** A choice that runs a finance action with fixed params. */
function viaAction(label: string, id: string, tags: string[], params: (s: GameStateV2, data: Record<string, number | string>) => Record<string, number | string | boolean> = () => ({})): ChoiceV2 {
  const a = action(id);
  return {
    label, tags,
    preview: (s) => a.preview(s, params(s, {})),
    available: (s) => a.available(s),
    apply: (s, ctx, data) => a.apply(s, ctx, params(s, data)),
  };
}

const hasDealSinceStart = (s: GameStateV2, t: string) => s.player.finance.deals.some((d) => d.template === t && d.day >= 0);

export const FINANCE_EVENTS: EventDefV2[] = [
  {
    id: 'E02', title: 'Recapitalisation', icon: 'finance', owner: 'WS3', crisis: false, deadlineDays: 45, defaultChoice: 1,
    when: (s) => (s.player.board.preset === 'legacyNonprofit' && s.time.day >= 92 && s.player.finance.ws3?.recap.startDay === undefined && !s.player.finance.ws3?.recap.refused ? { tranche: s.player.finance.tranches.find((t) => t.condition === 'recapitalisation')?.amount ?? 30 } : false),
    text: (_s, d) => `Investors will release the $${d.tranche}B tranche only if the [[capped-profit]] structure becomes a [[PBC]]. A restructure takes about four quarters of [[Attorney General]] review. Refuse and the tranche is cut to $10B.`,
    choices: [viaAction('Restructure', 'fin.recap', ['growth', 'governance']), viaAction('Keep nonprofit', 'fin.refuseRecap', ['mission', 'governance'])],
  },
  {
    id: 'E03', title: 'Partner offer', icon: 'finance', owner: 'WS3', crisis: false, cooldown: 180, deadlineDays: 30, defaultChoice: 1,
    when: (s) => {
      if (s.time.day < 92 || hasDealSinceStart(s, 'hyperscalerEquity') || s.player.finance.state === 'distress') return false;
      const p = partnerFor(s, 'hyperscalerEquity');
      if (!p) return false;
      const t = dealTerms(s, 'hyperscalerEquity', p);
      return { partner: p, equity: Math.round(t.equityNow + t.equityLater), commit: Math.round(t.commitPerQ * t.commitQ), years: t.commitQ / 4 };
    },
    text: (_s, d) => `${d.partner} offers $${d.equity}B of equity in tranches for a $${d.commit}B take-or-pay cloud commitment over ${d.years} years, an observer seat and [[exclusivity]].`,
    choices: [
      viaAction('Accept', 'fin.acceptDeal', ['growth', 'strategic'], (s) => ({ template: 'hyperscalerEquity', partner: partnerFor(s, 'hyperscalerEquity') ?? '' })),
      { label: 'Decline', tags: ['independence'], preview: (s) => ({ costs: [{ currency: 'cash', amount: -(dealTerms(s, 'hyperscalerEquity', partnerFor(s, 'hyperscalerEquity') ?? 'Northwind Cloud').equityNow) }], gains: [], exposure: [] }), apply: () => {} },
    ],
  },
  {
    id: 'E04', title: 'Vendor offer', icon: 'finance', owner: 'WS3', crisis: false, cooldown: 270, deadlineDays: 30, defaultChoice: 1,
    when: (s) => {
      if (s.time.day < 184 || hasDealSinceStart(s, 'chipVendorEquity') || s.player.finance.state === 'distress' || s.market.ws3?.playerFill >= 0.95) return false;
      const p = partnerFor(s, 'chipVendorEquity');
      if (!p) return false;
      const t = dealTerms(s, 'chipVendorEquity', p);
      return { partner: p, equity: Math.round(t.equityLater), perQ: Math.round(t.h100e / 1e3), quarters: t.commitQ };
    },
    text: (_s, d) => `Chips are rationed. ${d.partner} will invest $${d.equity}B as you deploy its systems, if you sign a ${d.quarters}-quarter [[LTA]] for ${d.perQ}k H100e per quarter. Priority allocation follows.`,
    choices: [
      { label: 'Accept', tags: ['growth', 'strategic'], preview: (s) => dealPreview(s, dealTerms(s, 'chipVendorEquity', partnerFor(s, 'chipVendorEquity') ?? 'Silica Systems')), apply: (s, ctx) => {
        const r = action('fin.seekPartner');
        r.apply(s, ctx, { template: 'chipVendorEquity' });
        const o = s.player.finance.ws3.offers[s.player.finance.ws3.offers.length - 1];
        if (o) action('fin.acceptDeal').apply(s, ctx, { offerId: o.id });
      } },
      { label: 'Decline', tags: ['independence'], preview: () => ({ costs: [{ currency: 'compute', amount: -1 }], gains: [], exposure: [] }), apply: () => {} },
    ],
  },
  {
    id: 'E26', title: 'Cash crunch', icon: 'alert', owner: 'WS3', crisis: true, cooldown: 120, deadlineDays: 21, defaultChoice: 2,
    when: (s) => (s.player.finance.state === 'distress' ? { runway: s.player.finance.runwayQ } : false),
    text: (_s, d) => `Runway is ${d.runway} quarters. The revolver is frozen and only rescue capital will deal with you.`,
    choices: [
      viaAction('Down round', 'fin.downRound', ['survive', 'dilution']),
      viaAction('Strategic rescue', 'fin.rescue', ['survive', 'control']),
      viaAction('Renegotiate', 'fin.renegotiate', ['survive']),
      viaAction('Sell chips', 'fin.sellChips', ['survive', 'shrink']),
      viaAction('Cancel contracts', 'fin.cancelContract', ['survive', 'shrink']),
    ],
  },
];
