// Strategic deals: offers, terms, strings, vetoes, rescue (V2-SPEC §3.7.4; research/15 §1.7). Owner: WS3.
import { DEAL_TEMPLATES, DEAL_TERMS, partnerDef, PARTNER_DEFS } from '../../../data/v2/deals';
import { dayOfQuarter } from '../core/time';
import type { BoardVote, GameStateV2, Money, StrategicDeal, SystemCtx } from '../types';
import { addCloud } from '../compute/orders';
import { cloudPricePerYear } from '../compute/market';
import { newSite } from '../compute/sites';
import { addSeat, commitmentsVote, voteGate } from './board';
import { controlVotes } from './charter';
import { DEBT_TERMS } from '../../../data/v2/deals';
import { issue } from './equity';
import { ensureWs3, yearStats, type DealOffer } from './ext';
import { addLedger, qOf, bookCash } from './ledger';
import { runwayOf } from './runway';

type Template = StrategicDeal['template'];

/** Partners whose seat vetoes a deal with `partner` (exclusivity strings, §3.7.4). */
export function vetoesOf(s: GameStateV2, partner: string): string[] {
  const out: string[] = [];
  for (const d of s.player.finance.deals) {
    if (!d.strings.exclusivity || d.partner === partner) continue;
    if (partnerDef(d.partner)?.competitors.includes(partner)) out.push(d.partner);
  }
  return out;
}

/** Why `partner` cannot do `template` with the player now (or undefined if it can). */
export function dealBlocker(s: GameStateV2, template: Template, partner: string): string | undefined {
  const p = partnerDef(partner);
  if (!p || !p.templates.includes(template)) return `${partner} does not offer ${template}`;
  const anchor = s.capital.ws3?.anchors[partner];
  if (anchor && anchor !== 'player') return `${partner} already anchors another lab`;
  const v = vetoesOf(s, partner);
  if (v.length) return `${v[0]}'s board seat vetoes deals with ${partner}`;
  const f = s.player.finance;
  if ((f.state === 'distress' || f.state === 'insolvent') && template !== 'vendorFinance') return 'Distress: only a rescue is on offer';
  return undefined;
}

/** Default partner for a template: the first one that can deal now. */
export function partnerFor(s: GameStateV2, template: Template): string | undefined {
  return PARTNER_DEFS.find((p) => p.templates.includes(template) && !dealBlocker(s, template, p.id))?.id;
}

/** Terms a partner would offer now (R15 §1.7 sizes; [D] where noted in data/v2/deals.ts). */
export function dealTerms(s: GameStateV2, template: Template, partner: string, rescue = false): Omit<DealOffer, 'id' | 'day' | 'expiresDay'> {
  const f = s.player.finance;
  const V = Math.max(10, f.valuation);
  const R = f.revenueRun;
  const kW = s.power.kWPerH100e;
  const tpl = DEAL_TEMPLATES.find((t) => t.id === template)!;
  const base = { template, partner, equityNow: 0, equityLater: 0, commitPerQ: 0, commitQ: 0, h100e: 0, unitPrice: 0, strings: { ...tpl.strings }, rescue };
  if (rescue) {
    const burn = Math.max(0, runwayOf(s).burnQ);
    // Distressed price: about half of the mark for the stake, sized to ~2 quarters of burn [D].
    return { ...base, equityNow: Math.min(0.15 * V, Math.max(DEAL_TERMS.rescue.minCash, 2 * burn)), strings: { boardSeat: true, exclusivity: true, ipRights: true } };
  }
  switch (template) {
    case 'hyperscalerEquity': {
      const t = DEAL_TERMS.hyperscaler;
      const E = Math.max(t.trancheMin, Math.min(t.trancheMax, t.equityShareOfV * V));
      const C = t.commitMult * E * t.tranches;
      const perYear = C / t.years;
      return { ...base, equityNow: E, equityLater: E * (t.tranches - 1), commitPerQ: perYear / 4, commitQ: t.years * 4, h100e: (perYear * 1e6) / cloudPricePerYear(s), unitPrice: cloudPricePerYear(s) };
    }
    case 'customASIC': {
      const t = DEAL_TERMS.asic;
      const perQ = (t.gw * 1e6) / kW / t.quarters;
      const price = s.market.listPrice * t.priceMult;
      return { ...base, commitPerQ: (perQ * price) / 1e6, commitQ: t.quarters, h100e: perQ, unitPrice: price };
    }
    case 'chipVendorEquity': {
      const t = DEAL_TERMS.vendorEquity;
      const perQ = (t.gw * 1e6) / kW / t.quarters;
      const price = s.market.listPrice * 0.95;
      return { ...base, equityLater: t.perGW * t.gw, commitPerQ: (perQ * price) / 1e6, commitQ: t.quarters, h100e: perQ, unitPrice: price };
    }
    case 'vendorFinance': {
      const t = DEAL_TERMS.vendorNote;
      return { ...base, equityNow: Math.min(t.max, t.revenueMult * Math.max(R, 10)) };
    }
    case 'sovereign': {
      const t = DEAL_TERMS.sovereign;
      return { ...base, equityNow: Math.max(t.min, Math.min(t.max, t.equityShareOfV * V)) };
    }
  }
}

/** "Seek partner": create an offer valid for 60 days. Returns the offer or a reason string. */
export function seekPartner(s: GameStateV2, ctx: SystemCtx, template: Template, partner?: string): DealOffer | string {
  ensureWs3(s);
  const p = partner ?? partnerFor(s, template);
  if (!p) return `No partner will do ${template} now`;
  const why = dealBlocker(s, template, p);
  if (why) return why;
  const offer: DealOffer = { id: `OF${s.time.day}-${s.player.finance.ws3.offers.length}`, day: s.time.day, expiresDay: s.time.day + DEAL_TERMS.offerDays, ...dealTerms(s, template, p) };
  s.player.finance.ws3.offers.push(offer);
  ctx.log('finance', `${p} offers a ${template} deal.`);
  return offer;
}

/** Rescue offer (distress menu E26 / action): a partner injects cash for control strings. */
export function rescueOffer(s: GameStateV2): DealOffer | undefined {
  const p = PARTNER_DEFS.find((x) => (x.kind === 'hyperscaler' || x.kind === 'sovereign') && !vetoesOf(s, x.id).length && (!s.capital.ws3?.anchors[x.id] || s.capital.ws3.anchors[x.id] === 'player'));
  if (!p) return undefined;
  return { id: `RESCUE${s.time.day}`, day: s.time.day, expiresDay: s.time.day + 30, ...dealTerms(s, 'hyperscalerEquity', p.id, true) };
}

/** The partner's share of the equity right after signing these terms (the equity now and, for a rescue, the top-up to
 *  its stake), on a copy of the cap table. Later tranches are not counted (they may never land). */
export function partnerStakeAfter(s: GameStateV2, t: Pick<DealOffer, 'partner' | 'template' | 'equityNow' | 'rescue'>): number {
  const o = JSON.parse(JSON.stringify(s.player.finance.ownership)) as GameStateV2['player']['finance']['ownership'];
  const V = Math.max(10, s.player.finance.valuation);
  const eq = t.template === 'vendorFinance' ? 0 : t.equityNow;
  if (eq > 0) issue(o, eq / (V + eq), { kind: 'strat', name: t.partner });
  if (t.rescue) issue(o, Math.max(0, DEAL_TERMS.rescue.stake - (o.strat[t.partner] ?? 0)), { kind: 'strat', name: t.partner });
  return o.strat[t.partner] ?? 0;
}

/** The votes a deal needs: a sale of control (a holder past 50%: under PBC + trust the trust, §7.2, FIN3b; then the
 *  board, §7.3, FIN3c) and the board on firm commitments above 3× revenue (§7.3), in the order they are held. */
export function dealVotes(s: GameStateV2, t: Omit<DealOffer, 'id' | 'day' | 'expiresDay'>): BoardVote[] {
  // The trust's vote first: it cannot be forced, so a founder never pays the force cost for a deal the trust stops.
  return [...controlVotes(s, t.partner, partnerStakeAfter(s, t)), commitmentsVote(s, t.commitPerQ * 4)].filter((v): v is BoardVote => !!v);
}
/** The vote to show for a deal: the first failing one, else the first needed. */
export const dealVote = (vs: BoardVote[]) => vs.find((v) => !v.passes) ?? vs[0];

/** Accept a deal (equity, take-or-pay, board seat, exclusivity). Uses a matching open offer if there is one, else
 *  today's terms. Returns an error string if blocked (veto, anchor, board). */
export function acceptDeal(s: GameStateV2, ctx: SystemCtx, template: Template, partner: string, opts: { offerId?: string; force?: boolean } = {}): string | undefined {
  ensureWs3(s);
  const f = s.player.finance;
  const fx = f.ws3;
  const offer = fx.offers.find((o) => (opts.offerId ? o.id === opts.offerId : o.template === template && o.partner === partner));
  const rescue = !!offer?.rescue;
  if (!rescue) {
    const why = dealBlocker(s, template, partner);
    if (why) return why;
  }
  const t: Omit<DealOffer, 'id' | 'day' | 'expiresDay'> = offer ?? dealTerms(s, template, partner);
  // Major decision (spec §7.3): firm commitments above 3× revenue need the board's vote (FIN3a: no dice); under PBC +
  // trust a sale of control needs the trust (FIN3b). Votes before any side effect.
  for (const v of dealVotes(s, t)) {
    const no = voteGate(ctx, v, !!opts.force);
    if (no) return no;
  }
  if (offer) fx.offers = fx.offers.filter((o) => o !== offer);
  const tpl = DEAL_TEMPLATES.find((x) => x.id === template)!;
  const q = qOf(s);
  const V = Math.max(10, f.valuation);
  const ys = yearStats(s);
  const equityIn = (amt: Money, label: string) => {
    if (amt <= 0) return;
    issue(f.ownership, amt / (V + amt), { kind: 'strat', name: partner });
    f.valuation = V + amt;
    bookCash(s, ctx, amt, 'financing', label, partner);
    ys.dealEquity += amt;
  };
  if (rescue) {
    equityIn(t.equityNow, 'strategic rescue');
    const stake = DEAL_TERMS.rescue.stake;
    issue(f.ownership, Math.max(0, stake - (f.ownership.strat[partner] ?? 0)), { kind: 'strat', name: partner });
    addSeat(s, 'strategic', partner, 2);
    fx.lastRescueDay = s.time.day;
    ctx.log('alert', `${partner} rescues the company: $${t.equityNow.toFixed(0)}B for ${Math.round(stake * 100)}%, two board seats, exclusivity and IP rights.`, 4);
  } else {
    switch (template) {
      case 'hyperscalerEquity':
        equityIn(t.equityNow, 'hyperscaler equity');
        if (t.equityLater > 0) {
          const gw = (s.player.computeOnline * s.power.kWPerH100e) / 1e6;
          const half = t.equityLater / 2;
          f.tranches.push({ amount: half, dueDay: dayOfQuarter(s.time.startDate, q + 2), condition: `gw:${(gw + 0.5).toFixed(1)}`, deadline: dayOfQuarter(s.time.startDate, q + 8), source: `${partner} tranche 2` });
          f.tranches.push({ amount: half, dueDay: dayOfQuarter(s.time.startDate, q + 4), condition: `gw:${(gw + 1.5).toFixed(1)}`, deadline: dayOfQuarter(s.time.startDate, q + 10), source: `${partner} tranche 3` });
        }
        // The partner's own take-or-pay price, flat (FIN4 rebuilds partner deals on the expected path).
        addCloud(s, ctx, t.h100e, t.commitQ, partner, { flatPerH: t.unitPrice });
        break;
      case 'customASIC':
      case 'chipVendorEquity': {
        const id = `LTA${q}-${s.time.day}-${s.player.orders.length}`;
        s.player.orders.push({ id, lab: 'player', qty: t.h100e, kind: 'lta', price: t.unitPrice, deposit: 0, dueQ: q + 2, ltaStartQ: q + 2, ltaEndQ: q + 2 + t.commitQ, prepayFrac: 0, nonTW: false, delivered: 0, firm: true });
        addLedger(s, { payee: partner, kind: 'lta', perQuarter: t.commitPerQ, startDay: dayOfQuarter(s.time.startDate, q + 2), endDay: dayOfQuarter(s.time.startDate, q + 2 + t.commitQ), cancellableNoticeQ: null, penalty: 0 });
        if (template === 'customASIC') {
          // Separate supply pool (TPU/Trainium): served outside rationing; migration slows research 2–3 quarters [R15].
          fx.reserved.push({ perQ: t.h100e, fromQ: q + 2, toQ: q + 2 + t.commitQ });
          fx.asicMigrationUntil = s.time.day + 230;
        } else {
          const gw = (s.player.computeOnline * s.power.kWPerH100e) / 1e6;
          const n = DEAL_TERMS.vendorEquity.gw;
          for (let i = 1; i <= n; i++) f.tranches.push({ amount: t.equityLater / n, dueDay: dayOfQuarter(s.time.startDate, q + 1), condition: `gw:${(gw + i).toFixed(1)}`, deadline: dayOfQuarter(s.time.startDate, q + 12), source: `${partner} equity per GW` });
        }
        break;
      }
      case 'vendorFinance':
        f.debts.push({ id: `D-vn-${s.time.day}`, kind: 'vendorNote', principal: t.equityNow, drawn: t.equityNow, spreadBp: DEBT_TERMS.vendorNote.spreadBp, maturityDay: s.time.day + DEBT_TERMS.vendorNote.years * 365, covenant: 'convertsAtIPO' });
        bookCash(s, ctx, t.equityNow, 'financing', 'vendor note', partner);
        ys.vendorNotes += t.equityNow;
        break;
      case 'sovereign':
        equityIn(t.equityNow, 'sovereign equity');
        newSite(s, ctx, { path: 'gas', mw: DEAL_TERMS.sovereign.siteMW, region: 'Gulf', name: `${partner} campus` });
        ctx.bump('relations.scrutiny', 5, 'Gulf deal');
        ctx.bump('trust:congress', -5, 'Gulf deal');
        ctx.bump('gov.securityDemand', 3, 'Gulf deal');
        break;
    }
  }
  if (tpl.seat && !rescue) addSeat(s, tpl.seat.kind, partner, tpl.seat.weight);
  if (tpl.strategic || rescue) s.capital.ws3.anchors[partner] = 'player';
  f.deals.push({ id: `DL${s.time.day}-${f.deals.length}`, template, partner, day: s.time.day, strings: { ...t.strings } });
  if (!rescue) ctx.log('finance', `Deal signed: ${tpl.name} with ${partner}.`);
  return undefined;
}

/** Decline (drop) an open offer. */
export function declineDeal(s: GameStateV2, ctx: SystemCtx, offerId: string): void {
  const fx = s.player.finance.ws3;
  const o = fx.offers.find((x) => x.id === offerId);
  fx.offers = fx.offers.filter((x) => x.id !== offerId);
  if (o) ctx.log('finance', `Declined ${o.partner}'s ${o.template} offer.`);
}
