// Finance decision events (V2-SPEC §3.7.4–3.7.6, §4.2): E02 recapitalisation, E03/E04 partner offers, E26 distress
// menu. Owner: WS3 (content). WS4 owns the catalog and the director: add `...FINANCE_EVENTS` to
// events/catalog/company.ts. Choices reuse the finance ActionDefs, so previews and effects match the Finance panel.
import type { ChoiceV2, EventDefV2, GameStateV2 } from '../types';
import { dealPreview, FINANCE_ACTIONS } from './actions';
import { addSeat, BC_WARN, OUSTER_BC, ousterRiskQ } from './board';
import { dealTerms, partnerFor } from './deals';
import { ensureWs3 } from './ext';

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
  {
    // M4 telegraph and counterplay before an ouster (§3.7.5). Fires while confidence is below BC_WARN.
    id: 'E37', title: 'Board revolt', icon: 'alert', owner: 'WS3', crisis: true, cooldown: 120, deadlineDays: 30, defaultChoice: 3,
    when: (s) => (s.player.board.confidence < BC_WARN && s.flags['ws3.ousterDay'] === undefined ? { bc: Math.round(s.player.board.confidence) } : false),
    text: (_s, d) => `Board confidence is ${d.bc}. Directors are sounding out a replacement CEO; below ${OUSTER_BC} they may vote at any quarterly review.`,
    choices: [
      {
        label: 'New directors', tags: ['concede', 'governance'],
        preview: () => ({ costs: [{ currency: 'freedom', amount: -1, target: 'two independent directors join the board' }], gains: [{ currency: 'boardConf', amount: 15 }], exposure: [] }),
        apply: (s, ctx) => {
          if (s.player.board.seats.length < 10) {
            addSeat(s, 'independent', `Independent director ${s.time.day}a`, 1);
            addSeat(s, 'independent', `Independent director ${s.time.day}b`, 1);
          }
          ctx.bump('board.confidence', 15, 'E37 new independent directors');
        },
      },
      {
        label: 'Capex freeze', tags: ['shrink', 'prudent'],
        preview: () => ({ costs: [{ currency: 'compute', amount: -1, target: 'no new sites or chip orders for 90 days' }], gains: [{ currency: 'boardConf', amount: 10 }], exposure: [] }),
        apply: (s, ctx) => {
          ensureWs3(s);
          for (const id of ['cmp.newSite', 'cmp.orderStandard', 'cmp.orderLTA', 'cmp.orderSpot']) s.player.finance.ws3.blockedUntil[id] = s.time.day + 90;
          ctx.bump('board.confidence', 10, 'E37 capex freeze');
        },
      },
      {
        label: 'Rally staff', tags: ['fight', 'morale'],
        preview: (s) => ({ costs: [{ currency: 'morale', amount: -5, target: 'staff spend goodwill' }], gains: [{ currency: 'boardConf', amount: 15, probability: rallyOdds(s) }], exposure: [{ currency: 'boardConf', amount: -5, probability: Math.round((1 - rallyOdds(s)) * 100) / 100 }] }),
        apply: (s, ctx) => {
          const ok = ctx.rng('finance').chance(rallyOdds(s));
          ctx.bump('morale', -5, 'E37 staff letter');
          ctx.bump('board.confidence', ok ? 15 : -5, ok ? 'E37 staff rally the board' : 'E37 staff letter backfires');
        },
      },
      {
        label: 'Ignore', tags: ['decline'],
        preview: (s) => ({ costs: [{ currency: 'boardConf', amount: -2, target: 'directors feel ignored' }], gains: [], exposure: [{ currency: 'freedom', amount: -1, probability: Math.round(ousterRiskQ(s) * 100) / 100, target: 'ouster vote at the next review' }] }),
        apply: (_s, ctx) => void ctx.bump('board.confidence', -2, 'E37 ignored'),
      },
    ],
  },
];

/** E37 'Rally staff': odds rise with overall morale (a loyal staff is the CEO's leverage, Nov 2023) [D]. */
export function rallyOdds(s: GameStateV2): number {
  return Math.round(Math.max(0.05, Math.min(0.95, (s.player.morale.overall - 40) / 40)) * 100) / 100;
}
