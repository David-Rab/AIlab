// Player actions in the Finance and Compute spheres (ActionDef catalog, V2-SPEC §3.7–3.8). Owner: WS3.
// Every preview lists a cost in a currency that is not among its gains (§2.7). Units: cash $B, compute H100e,
// dilution % points, boardConf points.
import { CAPEX_LEASE, COMMUNITY, DEAL_TEMPLATES, NEOCLOUD, SITE_PATHS, TRANSFORMER } from '../../../data/v2/deals';
import { dayOfQuarter } from '../core/time';
import { addCloud, addSpotRental, chipQuote, placeOrder, rentQuote, RENT_Q_MAX, spotRentalCap, TRANCHE_Q } from '../compute/orders';
import { addCommunityPackage, newSite, oppositionOdds, siteCapex, siteEtaQ, type SiteOpts } from '../compute/sites';
import { bloc } from '../actors/fx';
import { signCommitment } from '../actors/commitments';
import type { ActionDef, ChipOrder, CostLine, Debt, GameStateV2, Site, StrategicDeal, SystemCtx } from '../types';
import { boardApproval, boardBlocked, boardSupport, BOARD_VECTORS } from './board';
import { leaseAvailable, leaseRate, payOptions } from './capex';
import { debtHeadroom, drawDebt, newDebtRatePct, repayDebt } from './debt';
import { acceptDeal, dealBlocker, dealTerms, declineDeal, partnerFor, rescueOffer, seekPartner } from './deals';
import { acceptRepriced, bookRound, canRaise, lastPostMoney, pullRepriced, raiseCeiling, startRaise } from './equity';
import { ensureWs3, yearStats, type DealOffer } from './ext';
import { commitmentsPerYear, qOf, bookCash } from './ledger';
import { divisionBlock } from './parent';
import { runwayOf } from './runway';

type P = Record<string, number | string | boolean>;
type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
const str = (p: P, k: string, d: string) => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : d);
const bool = (p: P, k: string, d = false) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
const nextQDays = (s: GameStateV2) => Math.max(1, dayOfQuarter(s.time.startDate, qOf(s) + 1) - s.time.day);
const blocked = (s: GameStateV2, id: string): true | string => {
  const until = boardBlocked(s, id);
  return until !== undefined ? `Board blocked until day ${until}` : true;
};
const notInsolvent = (s: GameStateV2): true | string => (s.player.finance.state === 'insolvent' ? 'Insolvent' : true);

/** Board-approval exposure line for a would-be major decision. */
function boardExposure(s: GameStateV2, v: readonly number[]): CostLine {
  return { currency: 'boardConf', amount: -5, probability: Math.round((1 - boardSupport(s, v).p) * 100) / 100, target: 'board vote: a veto cancels it and blocks it for 90 days' };
}

/** Commitments check: the board votes when annual commitments would exceed 3× revenue (§3.7.5). */
function needsCommitVote(s: GameStateV2, addPerYear: number) {
  return addPerYear > 0 && commitmentsPerYear(s) + addPerYear > 3 * Math.max(1, s.player.finance.revenueRun);
}
/** Undefined when the commitment may go ahead; otherwise why the board stopped it. */
function commitGate(s: GameStateV2, ctx: SystemCtx, addPerYear: number, id: string, force: boolean): string | undefined {
  if (!needsCommitVote(s, addPerYear)) return undefined;
  return boardApproval(s, ctx, BOARD_VECTORS.commitments, id, force).why;
}

// ───────────────────────────── Equity ─────────────────────────────

const raise: ActionDef = {
  id: 'fin.raise', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Raise',
  boardVector: BOARD_VECTORS.dilution,
  available: (s) => {
    const b = divisionBlock(s) ?? blocked(s, 'fin.raise');
    return b !== true ? b : canRaise(s);
  },
  preview(s, p) {
    const anchor = str(p, 'anchor', '');
    const ipo = bool(p, 'ipo');
    const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!anchor, ipo });
    const ask = num(p, 'ask', c.max);
    const V = Math.max(1, s.player.finance.valuation);
    const over = Math.max(0, ask / Math.max(0.01, c.max) - 1);
    const pre = V * (1 - Math.min(0.6, 0.5 * over));
    const dil = ask / (pre + ask);
    const exposure: CostLine[] = [];
    if (over > 0) exposure.push({ currency: 'cash', amount: -ask, probability: Math.round((1 - Math.exp(-over)) * 100) / 100, lagDays: nextQDays(s) });
    if (dil > 0.1) exposure.push(boardExposure(s, BOARD_VECTORS.dilution));
    return { costs: [{ currency: 'dilution', amount: Math.round(dil * 1000) / 10 }], gains: [{ currency: 'cash', amount: ask, lagDays: nextQDays(s) }], exposure };
  },
  apply(s, ctx, p) {
    const anchor = str(p, 'anchor', '');
    const ipo = bool(p, 'ipo');
    const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!anchor, ipo });
    const ask = Math.max(0.1, num(p, 'ask', c.max));
    if (ask / (s.player.finance.valuation + ask) > 0.1) {
      const vote = boardApproval(s, ctx, BOARD_VECTORS.dilution, 'fin.raise', bool(p, 'force'));
      if (!vote.approved) return vote.why;
    }
    startRaise(s, ctx, ask, { ...(anchor ? { anchor } : {}), ipo });
  },
};

// ───────────────────────────── Repriced round: the player decides (LIMITS: no silent pull) ─────────────────────────────

const repricedAvail = (s: GameStateV2) => (s.player.finance.ws3?.repricedRound ? true : 'No repriced round to decide on');

const acceptRound: ActionDef = {
  id: 'fin.acceptRepriced', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Accept round',
  available: repricedAvail,
  preview(s) {
    const r = s.player.finance.ws3?.repricedRound;
    const ask = r?.ask ?? 0;
    const pre = r?.pre ?? Math.max(1, s.player.finance.valuation);
    const down = !r || pre < (r.lastPost || lastPostMoney(s));
    return {
      costs: [{ currency: 'dilution', amount: Math.round((ask / (pre + ask || 1)) * 1000) / 10 }, ...(down ? [{ currency: 'boardConf' as const, amount: -15, target: 'down round' }, { currency: 'talent' as const, amount: -5, target: 'senior attrition' }] : [])],
      gains: [{ currency: 'cash', amount: ask >= 20 ? ask * 0.5 : ask, target: ask >= 20 ? 'now; the rest as a tranche' : 'now' }],
      exposure: [],
    };
  },
  apply: (s, ctx) => acceptRepriced(s, ctx),
};

const pullRound: ActionDef = {
  id: 'fin.pullRepriced', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Pull round',
  available: repricedAvail,
  preview(s) {
    const r = s.player.finance.ws3?.repricedRound;
    return { costs: [{ currency: 'cash', amount: -(r?.ask ?? 0), target: 'money you do not raise' }], gains: [{ currency: 'dilution', amount: 0, target: 'no dilution' }, { currency: 'boardConf', amount: 0, target: 'no down-round hit' }], exposure: [] };
  },
  apply: (s, ctx) => pullRepriced(s, ctx),
};

const downRound: ActionDef = {
  id: 'fin.downRound', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Down round',
  available: (s) => divisionBlock(s) ?? (s.player.finance.state === 'distress' || s.player.finance.state === 'tight' ? true : 'Only when runway is tight or in distress'),
  preview(s) {
    const V = s.player.finance.valuation * 0.6;
    const amt = downRoundSize(s);
    return { costs: [{ currency: 'dilution', amount: Math.round((amt / (V + amt)) * 1000) / 10 }, { currency: 'boardConf', amount: -15 }], gains: [{ currency: 'cash', amount: amt }], exposure: [{ currency: 'talent', amount: -5 }] };
  },
  apply(s, ctx) {
    const amt = downRoundSize(s);
    const pre = s.player.finance.valuation * ctx.rng('finance').range(0.5, 0.7); // R15: down round at V × 0.5–0.7
    bookRound(s, ctx, amt, pre, { source: 'Rescue round' });
    if (s.player.finance.rounds.length) s.player.finance.rounds[s.player.finance.rounds.length - 1].down = true;
  },
};
function downRoundSize(s: GameStateV2) {
  return Math.max(10, Math.min(0.15 * s.player.finance.valuation * 0.6, 3 * Math.max(0, runwayOf(s).burnQ)));
}

// ───────────────────────────── Deals ─────────────────────────────

/** Preview of a deal's terms (Finance panel, events). */
export function dealPreview(s: GameStateV2, t: Omit<DealOffer, 'id' | 'day' | 'expiresDay'>): Preview {
  const V = Math.max(10, s.player.finance.valuation);
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const exposure: CostLine[] = [];
  const eq = t.template === 'vendorFinance' ? 0 : t.equityNow + t.equityLater;
  if (eq > 0) costs.push({ currency: 'dilution', amount: Math.round((eq / (V + eq)) * 1000) / 10, ...(t.equityNow <= 0 ? { lagDays: 182 } : {}) });
  if (t.equityNow > 0) gains.push({ currency: 'cash', amount: t.equityNow });
  if (t.equityLater > 0) gains.push({ currency: 'cash', amount: t.equityLater, lagDays: 182, probability: 0.8 });
  if (t.h100e > 0) gains.push({ currency: 'compute', amount: t.h100e, lagDays: 91 });
  if (t.commitPerQ > 0) costs.push({ currency: 'cash', amount: -t.commitPerQ * 4, target: `${t.partner} per year × ${(t.commitQ / 4).toFixed(0)} y` });
  if (t.template === 'customASIC') costs.push({ currency: 'progress', amount: -0.15, lagDays: 0, target: 'research −15% for ~2.5 quarters' });
  if (t.template === 'sovereign') costs.push({ currency: 'scrutiny', amount: 5 }, { currency: 'trust', amount: -5, target: 'congress' });
  if (t.template === 'vendorFinance') costs.push({ currency: 'boardConf', amount: -1 }, { currency: 'cash', amount: -t.equityNow * 0.08, target: 'interest per year' });
  if (t.strings.exclusivity) exposure.push({ currency: 'freedom', amount: -1, target: 'vetoes deals with competitors' });
  if (t.strings.revenueShare) costs.push({ currency: 'revenue', amount: -t.strings.revenueShare * s.player.finance.revenueRun, target: 'revenue share per year' });
  if (t.rescue) costs.push({ currency: 'freedom', amount: -2, target: 'control: 2 seats, exclusivity, IP rights' });
  if (needsCommitVote(s, t.commitPerQ * 4)) exposure.push(boardExposure(s, BOARD_VECTORS.commitments));
  if (!costs.length) costs.push({ currency: 'staffTime', amount: 1 });
  return { costs, gains, exposure };
}

const seek: ActionDef = {
  id: 'fin.seekPartner', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Seek partner',
  available: (s) => divisionBlock(s) ?? notInsolvent(s),
  preview(s, p) {
    const tpl = str(p, 'template', 'hyperscalerEquity') as StrategicDeal['template'];
    const partner = str(p, 'partner', partnerFor(s, tpl) ?? '');
    const pv = partner ? dealPreview(s, dealTerms(s, tpl, partner)) : { costs: [], gains: [], exposure: [] };
    return { costs: [{ currency: 'staffTime', amount: 2, target: 'prod staff, 2 weeks' }], gains: [], exposure: [...pv.gains.map((g) => ({ ...g, probability: 0.9 })), ...pv.costs] };
  },
  apply(s, ctx, p) {
    const tpl = str(p, 'template', 'hyperscalerEquity') as StrategicDeal['template'];
    const r = seekPartner(s, ctx, tpl, str(p, 'partner', '') || undefined);
    if (typeof r === 'string') {
      ctx.log('finance', r);
      return r;
    }
  },
};

function offerFor(s: GameStateV2, p: P): Omit<DealOffer, 'id' | 'day' | 'expiresDay'> | undefined {
  const offers = s.player.finance.ws3?.offers ?? [];
  const id = str(p, 'offerId', '');
  const o = id ? offers.find((x) => x.id === id) : offers[0];
  if (o) return o;
  const tpl = str(p, 'template', 'hyperscalerEquity') as StrategicDeal['template'];
  const partner = str(p, 'partner', partnerFor(s, tpl) ?? '');
  return partner ? dealTerms(s, tpl, partner) : undefined;
}

const accept: ActionDef = {
  id: 'fin.acceptDeal', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Accept deal',
  boardVector: BOARD_VECTORS.commitments,
  available: (s) => {
    const b = divisionBlock(s) ?? blocked(s, 'fin.acceptDeal');
    if (b !== true) return b;
    return s.player.finance.ws3?.offers.length ? true : 'No open offer (seek a partner first)';
  },
  preview(s, p) {
    const t = offerFor(s, p);
    return t ? dealPreview(s, t) : { costs: [{ currency: 'staffTime', amount: 1 }], gains: [], exposure: [] };
  },
  apply(s, ctx, p) {
    const offers = s.player.finance.ws3.offers;
    const id = str(p, 'offerId', '');
    const o = id ? offers.find((x) => x.id === id) : offers[0];
    if (!o) return;
    const err = acceptDeal(s, ctx, o.template, o.partner, { offerId: o.id, force: bool(p, 'force') });
    if (err) {
      ctx.log('finance', err, 2);
      return err;
    }
  },
};

const decline: ActionDef = {
  id: 'fin.declineDeal', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Decline deal',
  available: (s) => (s.player.finance.ws3?.offers.length ? true : 'No open offer'),
  preview(s, p) {
    const t = offerFor(s, p);
    const lost: CostLine[] = t ? dealPreview(s, t).gains.map((g) => ({ ...g, amount: -g.amount })) : [];
    return { costs: lost.length ? lost : [{ currency: 'cash', amount: 0 }], gains: [], exposure: [] };
  },
  apply(s, ctx, p) {
    const offers = s.player.finance.ws3.offers;
    const id = str(p, 'offerId', offers[0]?.id ?? '');
    declineDeal(s, ctx, id);
  },
};

/** One strategic rescue per year [D, M4]: a second rescue inside a year is a sale of control in all but name. */
export const RESCUE_COOLDOWN_D = 365;

const rescue: ActionDef = {
  id: 'fin.rescue', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Rescue',
  available: (s) => {
    const f = s.player.finance;
    const div = divisionBlock(s);
    if (div) return div;
    if (f.state !== 'distress') return 'Only in distress';
    if (f.ws3?.lastRescueDay !== undefined && s.time.day - f.ws3.lastRescueDay < RESCUE_COOLDOWN_D) return 'Partners will not rescue you twice in a year';
    return rescueOffer(s) ? true : 'No partner will rescue you';
  },
  preview(s) {
    const o = rescueOffer(s);
    return o ? dealPreview(s, o) : { costs: [{ currency: 'freedom', amount: -2 }], gains: [], exposure: [] };
  },
  apply(s, ctx) {
    const o = rescueOffer(s);
    if (!o) return;
    s.player.finance.ws3.offers.push(o);
    acceptDeal(s, ctx, o.template, o.partner, { offerId: o.id });
  },
};

// ───────────────────────────── Debt ─────────────────────────────

const draw: ActionDef = {
  id: 'fin.drawDebt', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Borrow',
  boardVector: BOARD_VECTORS.newDebt,
  available: (s) => {
    const b = divisionBlock(s) ?? blocked(s, 'fin.drawDebt');
    if (b !== true) return b;
    const h = (['revolver', 'gpuTerm', 'bond'] as const).map((k) => debtHeadroom(s, k));
    return h.some((x) => x.max > 0) ? true : h[0].why ?? 'No debt capacity';
  },
  preview(s, p) {
    const kind = str(p, 'kind', 'revolver') as Debt['kind'];
    const h = debtHeadroom(s, kind);
    const amt = Math.min(num(p, 'amount', h.max), h.max);
    const rate = newDebtRatePct(s, kind);
    const exposure: CostLine[] = [{ currency: 'cash', amount: -amt, target: 'covenant: called if breached', probability: 0.05 }];
    if (kind !== 'revolver' && amt > 0.2 * s.player.finance.revenueRun) exposure.push(boardExposure(s, BOARD_VECTORS.newDebt));
    return { costs: [{ currency: 'boardConf', amount: -1 }, { currency: 'cash', amount: -(amt * rate) / 100, target: 'interest per year' }], gains: [{ currency: 'cash', amount: amt }], exposure };
  },
  apply(s, ctx, p) {
    const kind = str(p, 'kind', 'revolver') as Debt['kind'];
    const h = debtHeadroom(s, kind);
    const amt = Math.min(num(p, 'amount', h.max), h.max);
    if (amt <= 0) return;
    if (kind !== 'revolver' && amt > 0.2 * s.player.finance.revenueRun) {
      const vote = boardApproval(s, ctx, BOARD_VECTORS.newDebt, 'fin.drawDebt', bool(p, 'force'));
      if (!vote.approved) return vote.why;
    }
    drawDebt(s, ctx, kind, amt);
    ctx.bump('board.confidence', -1, 'new borrowing');
  },
};

const repay: ActionDef = {
  id: 'fin.repayDebt', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Repay',
  available: (s) => (s.player.finance.debts.some((d) => d.drawn > 0) ? true : 'No drawn debt'),
  preview(s, p) {
    const drawn = s.player.finance.debts.reduce((a, d) => a + d.drawn, 0);
    const amt = Math.min(num(p, 'amount', drawn), drawn, Math.max(0, s.player.finance.cash));
    return { costs: [{ currency: 'cash', amount: -amt }], gains: [{ currency: 'boardConf', amount: 1 }], exposure: [] };
  },
  apply(s, ctx, p) {
    const drawn = s.player.finance.debts.reduce((a, d) => a + d.drawn, 0);
    const paid = repayDebt(s, ctx, num(p, 'amount', drawn), str(p, 'id', '') || undefined);
    if (paid > 0) ctx.bump('board.confidence', 1, 'debt repaid');
  },
};

// ───────────────────────────── Governance ─────────────────────────────

const recap: ActionDef = {
  id: 'fin.recap', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Recapitalise',
  available: (s) => {
    const f = s.player.finance;
    if (s.player.board.preset !== 'legacyNonprofit') return 'Only for the capped-profit nonprofit';
    if (f.ws3?.recap.startDay !== undefined || f.ws3?.recap.refused) return 'Already decided';
    if (s.time.day < 92) return 'The recapitalisation question comes up in Q4 2025 (E02)';
    return true;
  },
  preview(s) {
    const t = s.player.finance.tranches.find((x) => x.condition === 'recapitalisation');
    return {
      costs: [{ currency: 'scrutiny', amount: 5, target: 'Attorney General review' }, { currency: 'morale', amount: -3, target: 'safety staff' }],
      gains: [{ currency: 'cash', amount: t ? t.amount - 10 : 20, lagDays: 365, target: 'frees the conditional tranche' }],
      exposure: [{ currency: 'boardConf', amount: 5, lagDays: 365 }],
    };
  },
  apply(s, ctx) {
    ensureWs3(s);
    s.player.finance.ws3.recap.startDay = s.time.day;
    ctx.bump('relations.scrutiny', 5, 'recapitalisation', 'AG review');
    ctx.bump('morale.safety', -3, 'recapitalisation');
    ctx.log('finance', 'Recapitalisation begun: about four quarters of Attorney General review.');
  },
};

const refuseRecap: ActionDef = {
  id: 'fin.refuseRecap', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Keep nonprofit',
  available: recap.available,
  preview(s) {
    const t = s.player.finance.tranches.find((x) => x.condition === 'recapitalisation');
    return { costs: [{ currency: 'cash', amount: -(t ? t.amount - 10 : 20), target: 'tranche cut to $10B' }], gains: [{ currency: 'morale', amount: 3, target: 'safety staff' }], exposure: [] };
  },
  apply(s, ctx) {
    ensureWs3(s);
    const f = s.player.finance;
    f.ws3.recap.refused = true;
    for (const t of f.tranches) {
      if (t.condition !== 'recapitalisation') continue;
      t.amount = Math.min(10, t.amount);
      delete t.condition;
      delete t.deadline;
    }
    ctx.bump('morale.safety', 3, 'kept the nonprofit structure');
  },
};

// ───────────────────────────── Compute: Buy chips (spec §5) ─────────────────────────────

type ChipPay = NonNullable<ChipOrder['pay']>;
/** Buy-chips parameters: `term` 0 = spot, 1 = one batch, 4–16 = quarterly tranches (always firm); `firm` makes a
 *  batch take-or-pay; `pay` (spot and batches) = cash | lease | loan. */
function chipParams(p: P) {
  const term = Math.max(0, Math.round(num(p, 'term', 1)));
  const tranches = term >= 2;
  const pay = (tranches ? 'cash' : str(p, 'pay', 'cash')) as ChipPay;
  return { qty: Math.max(1e4, num(p, 'qty', 0.5e6)), term: tranches ? Math.max(TRANCHE_Q.min, Math.min(TRANCHE_Q.max, term)) : term, firm: tranches || (term === 1 && bool(p, 'firm')), nonTW: bool(p, 'nonTW'), prepay: num(p, 'prepay', 0.3), pay: (['cash', 'lease', 'loan'] as const).includes(pay) ? pay : 'cash' };
}
const lagTo = (s: GameStateV2, q: number) => Math.max(0, dayOfQuarter(s.time.startDate, q) - s.time.day);

const buyChips: ActionDef = {
  id: 'cmp.buyChips', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Buy chips',
  boardVector: BOARD_VECTORS.commitments,
  available: (s) => {
    const b = blocked(s, 'cmp.buyChips');
    return b !== true ? b : notInsolvent(s);
  },
  preview(s, p) {
    const c = chipParams(p);
    const qt = chipQuote(s, c.term, c.qty, c);
    const costs: CostLine[] = [];
    if (qt.kind === 'lta') {
      costs.push({ currency: 'cash', amount: -qt.later, lagDays: lagTo(s, qt.dueQ), target: `first of ${qt.quarters} quarterly payments (take-or-pay)` });
      costs.push({ currency: 'cash', amount: -(c.qty * qt.prices![qt.quarters - 1]) / 1e6, lagDays: lagTo(s, qt.dueQ + qt.quarters - 1), target: 'last payment (expected path)' });
    } else {
      if (qt.now > 0) costs.push({ currency: 'cash', amount: -qt.now, target: 'deposit now' });
      const opt = payOptions(s, qt.later, 'chips').find((o) => o.id === c.pay);
      const lag = lagTo(s, qt.dueQ);
      if (c.pay === 'lease' && opt) costs.push({ currency: 'cash', amount: -opt.perYear, lagDays: lag, target: `lease per year × ${opt.years} y from delivery` });
      else if (c.pay === 'loan' && opt) costs.push({ currency: 'cash', amount: -opt.now, lagDays: lag, target: 'on delivery (rest borrowed against the chips)' }, { currency: 'cash', amount: -opt.perYear, lagDays: lag, target: 'chip-loan interest per year' });
      else costs.push({ currency: 'cash', amount: -qt.later, lagDays: lag, target: 'on delivery' });
    }
    const fill = s.market.ws3?.playerFill ?? 1;
    const exposure: CostLine[] = [];
    if (fill < 0.99) exposure.push({ currency: 'compute', amount: -c.qty * (1 - fill), probability: 0.5, target: c.firm ? 'rationed (firm: priority weight +0.5)' : 'rationed: delivery rolls forward' });
    exposure.push({ currency: 'compute', amount: 0, target: 'needs free MW to go online' });
    if (qt.kind === 'lta' && needsCommitVote(s, qt.later * 4)) exposure.push(boardExposure(s, BOARD_VECTORS.commitments));
    return { costs, gains: [{ currency: 'compute', amount: qt.kind === 'lta' ? c.qty * qt.quarters : c.qty, lagDays: lagTo(s, qt.dueQ + 1) }], exposure };
  },
  apply(s, ctx, p) {
    const c = chipParams(p);
    const rate = c.pay === 'lease' ? leaseRate(s) : undefined;
    if (c.pay === 'lease' && rate === undefined) return leaseAvailable(s) as string;
    if (c.term >= 2) {
      const qt = chipQuote(s, c.term, c.qty, c);
      const no = commitGate(s, ctx, qt.later * 4, 'cmp.buyChips', bool(p, 'force'));
      if (no) return no;
    }
    placeOrder(s, ctx, c.term, c.qty, { ...c, ...(rate !== undefined ? { leaseRate: rate } : {}) });
  },
};

// ───────────────────────────── Compute: Rent compute (spec §5) ─────────────────────────────

/** Rent parameters: `term` in quarters (1 = a one-quarter spot rental; 4–20 = a contract from next quarter), `firm`
 *  (default) or cancellable; `provider` (default the neocloud). */
function rentParams(p: P) {
  return { h100e: Math.max(1e4, num(p, 'h100e', 0.5e6)), term: Math.max(1, Math.min(RENT_Q_MAX, Math.round(num(p, 'term', 4)))), firm: bool(p, 'firm', true), provider: str(p, 'provider', NEOCLOUD) };
}

const rentCompute: ActionDef = {
  id: 'cmp.rentCompute', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Rent compute',
  boardVector: BOARD_VECTORS.commitments,
  available: (s) => {
    const b = blocked(s, 'cmp.rentCompute');
    return b !== true ? b : notInsolvent(s);
  },
  preview(s, p) {
    const r = rentParams(p);
    if (r.term <= 1) {
      const got = Math.min(r.h100e, Math.max(0, spotRentalCap(s) - (s.player.finance.ws3?.rentals ?? []).reduce((a, x) => a + (x.endDay > s.time.day ? x.h100e : 0), 0)));
      return { costs: [{ currency: 'cash', amount: -(got * s.market.rental * 8760) / 1e9 / 4, target: 'spot rental for one quarter' }], gains: [{ currency: 'compute', amount: got, lagDays: 0 }], exposure: got < r.h100e ? [{ currency: 'compute', amount: -(r.h100e - got), target: 'spot rental cap' }] : [] };
    }
    const qt = rentQuote(s, r.h100e, r.term, r.firm);
    const lag = nextQDays(s);
    const costs: CostLine[] = r.firm
      ? [{ currency: 'cash', amount: -qt.perQ[0], lagDays: lag, target: `first of ${qt.quarters} quarterly payments (take-or-pay)` }, { currency: 'cash', amount: -qt.perQ[qt.quarters - 1], lagDays: lag + (qt.quarters - 1) * 91, target: 'last payment (expected path)' }]
      : [{ currency: 'cash', amount: -qt.perQ[0], lagDays: lag, target: 'per quarter at today\'s spot × 1.15, re-priced quarterly (1 q notice)' }];
    const exposure: CostLine[] = r.firm ? [] : [{ currency: 'compute', amount: -r.h100e, probability: 0.5, target: 'cancellable capacity is rationed in a chip shortage' }];
    if (needsCommitVote(s, qt.perQ.slice(0, 4).reduce((a, b) => a + b, 0))) exposure.push(boardExposure(s, BOARD_VECTORS.commitments));
    return { costs, gains: [{ currency: 'compute', amount: r.h100e, lagDays: lag }], exposure };
  },
  apply(s, ctx, p) {
    const r = rentParams(p);
    if (r.term <= 1) {
      const got = addSpotRental(s, r.h100e);
      ctx.log('finance', `Spot rental: ${(got / 1e3).toFixed(0)}k H100e for a quarter at $${s.market.rental.toFixed(2)}/h.`);
      return got > 0 ? undefined : 'No spot capacity left';
    }
    const qt = rentQuote(s, r.h100e, r.term, r.firm);
    const no = commitGate(s, ctx, qt.perQ.slice(0, 4).reduce((a, b) => a + b, 0), 'cmp.rentCompute', bool(p, 'force'));
    if (no) return no;
    addCloud(s, ctx, r.h100e, r.term, r.provider, { firm: r.firm });
  },
};

// ───────────────────────────── Compute: sites (spec §4 payment options) ─────────────────────────────

function siteOpts(s: GameStateV2, p: P): SiteOpts {
  const path = str(p, 'path', 'brownfield') as Site['path'];
  const def = SITE_PATHS[path] ?? SITE_PATHS.brownfield;
  const pay = str(p, 'pay', 'cash') === 'lease' && path !== 'lease' ? 'lease' : 'cash';
  const rate = pay === 'lease' ? leaseRate(s) : undefined;
  return {
    path: SITE_PATHS[path] ? path : 'brownfield', mw: Math.min(def.maxMW, num(p, 'mw', Math.min(1000, def.maxMW))), crash: bool(p, 'crash'),
    community: bool(p, 'community', s.player.policies.communityBenefits), pay, ...(rate !== undefined ? { leaseRate: rate } : {}),
  };
}

const site: ActionDef = {
  id: 'cmp.newSite', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'New site',
  available: (s) => {
    const b = blocked(s, 'cmp.newSite');
    return b !== true ? b : notInsolvent(s);
  },
  preview(s, p) {
    const o = siteOpts(s, p);
    const capex = siteCapex(o);
    const odds = oppositionOdds(s, { path: o.path, crash: !!o.crash, communityPackage: !!o.community });
    const eta = siteEtaQ(s, o) * 91;
    const H = (o.mw * 1000) / s.power.kWPerH100e;
    const exposure: CostLine[] = [];
    let costs: CostLine[];
    if (o.path === 'lease') costs = [{ currency: 'cash', amount: -(o.mw / 1000) * 1.2, target: 'colocation rent per year × 5 (non-cancellable)' }, { currency: 'cash', amount: -capex, target: 'network fit-out' }];
    else if (o.pay === 'lease') {
      const opt = payOptions(s, capex, 'site', siteEtaQ(s, o) / 4).find((x) => x.id === 'lease')!;
      costs = [{ currency: 'cash', amount: -opt.now, lagDays: eta, target: `capex, your ${Math.round((1 - CAPEX_LEASE.siteShare) * 100)}% share` }, { currency: 'cash', amount: -opt.perYear, lagDays: eta, target: `lease per year × ${opt.years} y from go-live (${((opt.rate ?? 0) * 100).toFixed(0)}%)` }];
      exposure.push({ currency: 'cash', amount: -CAPEX_LEASE.rvgShare * capex * CAPEX_LEASE.siteShare, target: 'residual-value guarantee if you walk away' });
    } else costs = [{ currency: 'cash', amount: -capex, lagDays: eta, target: 'capex on the build schedule' }];
    if (odds.block > 0) exposure.push({ currency: 'compute', amount: -H, probability: Math.round(odds.block * 100) / 100, target: 'blocked by local opposition' });
    if (odds.delay > 0) exposure.push({ currency: 'compute', amount: -H, probability: Math.round(odds.delay * 100) / 100, lagDays: 182, target: 'delayed 1–3 quarters' });
    if (o.path === 'lease' && s.market.ws3 && o.mw / 1000 > s.market.ws3.leasePoolGW) exposure.push({ currency: 'compute', amount: -H, target: 'lease pool exhausted this quarter' });
    return { costs, gains: [{ currency: 'compute', amount: H, lagDays: eta, target: 'MW to install chips' }], exposure };
  },
  apply(s, ctx, p) {
    const o = siteOpts(s, p);
    if (o.pay === 'lease' && o.leaseRate === undefined) return leaseAvailable(s) as string;
    if (o.path === 'lease') o.mw = Math.min(o.mw, s.market.ws3.leasePoolGW * 1000);
    if (o.mw < 50) {
      ctx.log('finance', 'No colocation capacity left this quarter.');
      return 'No colocation capacity left this quarter';
    }
    newSite(s, ctx, o);
  },
};

/** Sites still able to take an upfront community package (in permitting, not yet rolled, not colocation). */
const packageable = (s: GameStateV2) => s.player.sites.filter((x) => x.stage === 'permitting' && !x.communityPackage && !x.ws3?.rolled && x.path !== 'lease');

/** Community package (spec §4; merges F1 and the per-site deal): with `siteId`, the upfront package for that site (≈ 3%
 *  of its capex, block odds × 0.5); without, the company default: every site still permitting gets it now and every
 *  new site by default, with the pledge to pay our own power and grid costs (a relations commitment, kept from F1). */
const community: ActionDef = {
  id: 'cmp.community', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Community package',
  available: (s) => (!s.player.policies.communityBenefits || packageable(s).length ? true : 'Company default on; no site in permitting without a package'),
  preview(s, p) {
    const one = str(p, 'siteId', '');
    const sites = one ? packageable(s).filter((x) => x.id === one) : s.player.policies.communityBenefits ? packageable(s).slice(0, 1) : packageable(s);
    const cost = sites.reduce((a, x) => a + x.capex * COMMUNITY.upfront, 0);
    const saved = sites.reduce((a, x) => a + ((x.mw * 1000) / s.power.kWPerH100e) * oppositionOdds(s, x).block * (1 - COMMUNITY.blockMult), 0);
    const costs: CostLine[] = [{ currency: 'cash', amount: -Math.max(cost, 0.01), lagDays: 0, target: `+${Math.round(COMMUNITY.upfront * 100)}% capex on ${sites.length} site${sites.length === 1 ? '' : 's'} (build schedule)` }];
    const gains: CostLine[] = [{ currency: 'compute', amount: saved, target: 'block risk halved (expected H100e kept)' }];
    if (!one && !s.player.policies.communityBenefits) {
      costs.push({ currency: 'freedom', amount: -1, target: 'pledge: every new site carries the package' });
      gains.push({ currency: 'approval', amount: 10, target: 'bloc:ratepayers' });
    }
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const one = str(p, 'siteId', '');
    if (one) {
      const x = packageable(s).find((y) => y.id === one);
      if (!x) return 'That site cannot take a package (past permitting or already has one)';
      addCommunityPackage(x);
      ctx.bump('pub.approval', 1, 'community benefits package', x.name);
      return;
    }
    if (!s.player.policies.communityBenefits) {
      s.player.policies.communityBenefits = true;
      signCommitment(s, ctx, 'communityPledge', 'Pay our own power and grid costs', 'communityPledge', {}, ['bloc:ratepayers', 'states'], { trust: 5, credibility: 8 });
      bloc(s, ctx, 'ratepayers', 10, 0, 'community package policy');
      ctx.bump('pub.dcNimby', -10, 'community package policy');
    }
    for (const x of packageable(s)) addCommunityPackage(x);
  },
};

const transformers: ActionDef = {
  id: 'cmp.preorderTransformers', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Transformers',
  available: notInsolvent,
  preview(s, p) {
    const gw = Math.max(0.1, num(p, 'gw', 2));
    return { costs: [{ currency: 'cash', amount: -gw * TRANSFORMER.costPerGW * TRANSFORMER.depositShare, target: '20% deposit' }, { currency: 'cash', amount: -gw * TRANSFORMER.costPerGW * 0.8, lagDays: s.power.transformerLeadQ * 91 }], gains: [{ currency: 'leadDays', amount: (s.power.transformerLeadQ - 8) * 91 + 91, target: 'no transformer wait for new sites' }], exposure: [] };
  },
  apply(s, ctx, p) {
    ensureWs3(s);
    const gw = Math.max(0.1, num(p, 'gw', 2));
    const cost = gw * TRANSFORMER.costPerGW;
    s.power.ws3.transformersGW += gw;
    bookCash(s, ctx, -cost, 'compute', 'transformer pre-order', `${gw.toFixed(1)} GW`);
    yearStats(s).capexSites += cost;
  },
};

// ───────────────────────────── Distress menu (E26) ─────────────────────────────

const renegotiate: ActionDef = {
  id: 'fin.renegotiate', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Renegotiate',
  available: (s) => {
    const f = s.player.finance;
    if (f.state !== 'distress' && f.state !== 'tight') return 'Only when runway is tight or in distress';
    if (f.ws3?.lastRenegotiationDay !== undefined && s.time.day - f.ws3.lastRenegotiationDay < 365) return 'Suppliers will renegotiate once a year';
    return true;
  },
  preview(s) {
    const firm = s.player.finance.ledger.filter((c) => c.endDay > s.time.day && c.cancellableNoticeQ === null).reduce((a, c) => a + c.perQuarter, 0);
    return { costs: [{ currency: 'dilution', amount: 2, target: 'warrants to suppliers' }], gains: [{ currency: 'cash', amount: firm * 0.35 * 4, target: '35% of next year’s commitments deferred' }], exposure: [] };
  },
  apply(s, ctx) {
    const f = s.player.finance;
    ensureWs3(s);
    for (const c of f.ledger) {
      if (c.endDay <= s.time.day || c.cancellableNoticeQ !== null) continue;
      const from = Math.max(s.time.day, c.startDay ?? -Infinity);
      const left = c.endDay - from;
      c.perQuarter *= 0.65; // suppliers accept a 25–50% deferral for warrants [R15]
      c.endDay = from + Math.round(left / 0.65);
    }
    f.ws3.lastRenegotiationDay = s.time.day;
    issueWarrants(s, 0.02);
    ctx.log('finance', 'Suppliers accept a 35% payment deferral in exchange for warrants.');
  },
};
function issueWarrants(s: GameStateV2, frac: number) {
  const o = s.player.finance.ownership;
  const k = 1 - frac;
  o.founder *= k; o.mission *= k; o.public *= k; o.fin = o.fin * k + frac;
  for (const n of Object.keys(o.strat)) o.strat[n] *= k;
}

/** Resale/sublease value of chips: ~1.5 years of spot rental [D]. */
const chipSaleValue = (s: GameStateV2, h: number) => (h * s.market.rental * 8760 * 1.5) / 1e9;

const sell: ActionDef = {
  id: 'fin.sellChips', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Sell chips',
  available: (s) => (ownedChips(s) > 0 ? true : 'No owned chips'),
  preview(s, p) {
    const h = Math.min(ownedChips(s), Math.max(1e4, num(p, 'qty', 0.2e6)));
    return { costs: [{ currency: 'compute', amount: -h }], gains: [{ currency: 'cash', amount: chipSaleValue(s, h) }], exposure: [] };
  },
  apply(s, ctx, p) {
    ensureWs3(s);
    let left = Math.min(ownedChips(s), Math.max(1e4, num(p, 'qty', 0.2e6)));
    const total = left;
    const inv = s.player.finance.ws3.inventory;
    for (const k of ['ready', 'transit'] as const) {
      const x = Math.min(left, inv[k]);
      if (x > 0) {
        inv.book *= 1 - x / Math.max(1, inv.ready + inv.transit);
        inv[k] -= x;
        left -= x;
      }
    }
    for (const x of s.player.sites) {
      if (left <= 0) break;
      const y = Math.min(left, x.installed);
      x.installed -= y;
      left -= y;
      s.player.finance.ws3.chipBook *= 1 - y / Math.max(1, total + 1e6);
    }
    bookCash(s, ctx, chipSaleValue(s, total), 'compute', 'chip sale', `${(total / 1e6).toFixed(2)}M H100e`);
  },
};
const ownedChips = (s: GameStateV2) => s.player.sites.reduce((a, x) => a + x.installed, 0) + (s.player.finance.ws3 ? s.player.finance.ws3.inventory.ready + s.player.finance.ws3.inventory.transit : 0);

const cancel: ActionDef = {
  id: 'fin.cancelContract', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Cancel contract',
  available: (s) => (cancellable(s).length ? true : 'Nothing cancellable'),
  preview(s, p) {
    const c = pickCancellable(s, str(p, 'id', ''));
    if (!c) return { costs: [{ currency: 'compute', amount: 0 }], gains: [], exposure: [] };
    return { costs: [{ currency: 'compute', amount: -c.h100e }, { currency: 'cash', amount: -c.penalty, target: 'notice / forfeit' }], gains: [{ currency: 'cash', amount: c.saved, target: 'future payments avoided' }], exposure: [] };
  },
  apply(s, ctx, p) {
    const c = pickCancellable(s, str(p, 'id', ''));
    if (!c) return;
    c.apply(ctx);
  },
};
interface Cancellable { id: string; h100e: number; penalty: number; saved: number; apply(ctx: SystemCtx): void }
function cancellable(s: GameStateV2): Cancellable[] {
  const out: Cancellable[] = [];
  for (const l of s.player.finance.ledger) {
    if (l.endDay <= s.time.day || l.cancellableNoticeQ === null) continue;
    const notice = l.cancellableNoticeQ;
    const cl = s.player.cloud.find((c) => `L-${c.id}` === l.id);
    const end = s.time.day + notice * 91;
    out.push({
      id: l.id, h100e: cl?.h100e ?? 0, penalty: 0, saved: (l.perQuarter * Math.max(0, l.endDay - Math.max(end, l.startDay ?? -Infinity))) / 91,
      apply(ctx) {
        l.endDay = Math.min(l.endDay, end);
        if (cl) cl.endDay = Math.min(cl.endDay, end);
        ctx.log('finance', `Cancelled ${l.payee} (ends after ${notice} quarter${notice > 1 ? 's' : ''} notice).`);
      },
    });
  }
  for (const o of s.player.orders) {
    if (o.kind !== 'standard' || o.firm || o.delivered > 0) continue;
    out.push({
      id: o.id, h100e: o.qty, penalty: o.deposit, saved: (o.qty * o.price * (1 - o.prepayFrac)) / 1e6,
      apply(ctx) {
        s.player.orders = s.player.orders.filter((x) => x !== o);
        ctx.log('finance', `Cancelled chip order ${o.id}; the $${o.deposit.toFixed(1)}B deposit is forfeit.`);
      },
    });
  }
  return out;
}
const pickCancellable = (s: GameStateV2, id: string) => {
  const all = cancellable(s);
  return all.find((c) => c.id === id) ?? all[0];
};

/** Accept every open offer of a given template (bots / tests convenience). */
export function acceptAllOffers(s: GameStateV2, ctx: SystemCtx, template?: StrategicDeal['template']): number {
  let n = 0;
  for (const o of [...(s.player.finance.ws3?.offers ?? [])]) if (!template || o.template === template) n += acceptDeal(s, ctx, o.template, o.partner, { offerId: o.id }) ? 0 : 1;
  return n;
}

/** Templates the Seek-partner picker shows, with availability. */
export function dealMenu(s: GameStateV2): { template: StrategicDeal['template']; name: string; partner?: string; blocked?: string }[] {
  return DEAL_TEMPLATES.map((t) => {
    const partner = partnerFor(s, t.id);
    return { template: t.id, name: t.name, ...(partner ? { partner } : { blocked: dealBlocker(s, t.id, partnerFor(s, t.id) ?? t.partnerKinds[0]) ?? 'No partner' }) };
  });
}

export const FINANCE_ACTIONS: ActionDef[] = [
  raise, seek, accept, decline, draw, repay, recap, refuseRecap,
  buyChips, rentCompute, site, community, transformers,
  downRound, rescue, renegotiate, sell, cancel, acceptRound, pullRound,
];



