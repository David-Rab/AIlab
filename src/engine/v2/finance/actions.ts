// Player actions in the Finance and Compute spheres (ActionDef catalog, V2-SPEC §3.7–3.8). Owner: WS3.
// Every preview shows what apply() does (§2.7 preview truth). Units: cash $B, compute H100e,
// dilution % points, boardConf points.
import { CAPEX_LEASE, DEBT_SIZING, LEVERS, MARKET, NEOCLOUD, PARTNER_DEFS, PARTNER_TERMS, partnerDef, RENT, SITE_MIN_MW, SOURCES, type PartnerSupply } from '../../../data/v2/deals';
import { dateOfDay, dayOfQuarter } from '../core/time';
import { addCloud, addSpotRental, chipQuote, placeOrder, rentQuote, RENT_Q_MAX, spotRentalCap, TRANCHE_Q } from '../compute/orders';
import { addCommunityPackage, newSite, oppositionOdds, siteCapex, siteLiveInQ, siteSchedule, type SiteOpts } from '../compute/sites';
import { bloc } from '../actors/fx';
import { signCommitment } from '../actors/commitments';
import type { ActionDef, ChipOrder, CostLine, Debt, GameStateV2, MilestoneType, PartnerTerms, Pitch, Site, SystemCtx } from '../types';
import { boardVote, commitmentsVote, CRITICS, criticsAvailable, criticsOusterShift, criticsSeat, criticsSide, withCriticsSeat, debtVote, founderControl, giveCriticsSeat, voteCost, voteGate } from './board';
import { MOOD_BASE, MOOD_LABEL, MOOD_SOURCES, moodWeight } from './mood';
import { leaseAvailable, leaseRate, payOptions } from './capex';
import { debtHeadroom, drawDebt, newDebtRatePct, repayDebt } from './debt';
import { anchorPartners, dealVote as firstVote, dealVotes, partnerOffers, partnerStakeAfter, partnerTerms, rescuePartner, signPartner, supplyOptions, termsEquity, type PartnerChoice } from './deals';
import { leadEstimate } from './observe';
import { acceptRepriced, bookRound, cancelTrancheShares, canIpo, closingAsk, canRaise, LARGE_ROUND, lastPostMoney, pullRepriced, raiseCeiling, roundSplit, startRaise } from './equity';
import { describeTarget, makeThesis, MILESTONES, PITCH, PITCHES, PROMISE_RESULT, promiseDeadline } from './promises';
import { ensureWs3 } from './ext';
import { deferFirm, qOf, bookCash, RENEGOTIATE } from './ledger';
import { divisionBlock } from './parent';
import { runwayOf } from './runway';
import { DUAL_CLASS_GOV, supplierTerms } from './story';

type P = Record<string, number | string | boolean>;
type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

const num = (p: P, k: string, d: number) => (typeof p[k] === 'number' ? (p[k] as number) : typeof p[k] === 'string' && p[k] !== '' && !Number.isNaN(Number(p[k])) ? Number(p[k]) : d);
const str = (p: P, k: string, d: string) => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : d);
const bool = (p: P, k: string, d = false) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
const nextQDays = (s: GameStateV2) => Math.max(1, dayOfQuarter(s.time.startDate, qOf(s) + 1) - s.time.day);
const notInsolvent = (s: GameStateV2): true | string => (s.player.finance.state === 'insolvent' ? 'Insolvent' : true);

/** Board confidence a down round costs on this board (spec §2.5 −15 × the board's multiplier for setbacks). */
const downRoundHit = (s: GameStateV2) => Math.round(MOOD_BASE.downRound * moodWeight(s, 'setbacks') * 10) / 10;
/** The down-round vote (spec §7.3), with its trigger in words. */
const downRoundVote = (s: GameStateV2, why: string) => boardVote(s, 'downRound', why);

// ───────────────────────────── Equity ─────────────────────────────

/** Milestone and pitch of a raise from its params (FIN2): `type` capability | scale | adoption (default: the first of
 *  scale, adoption, capability that can be pitched), `pitch` conservative | base | aggressive (default base). */
export function raiseTerms(s: GameStateV2, p: P): { type: MilestoneType; pitch: Pitch } {
  const want = str(p, 'type', '') as MilestoneType;
  const type = MILESTONES.includes(want) ? want : (['scale', 'adoption', 'capability'] as const).find((m) => typeof makeThesis(s, m, 'base') !== 'string') ?? 'capability';
  const pw = str(p, 'pitch', 'base') as Pitch;
  return { type, pitch: PITCHES.includes(pw) ? pw : 'base' };
}

/** What a raise of `ask` at a pitch would look like (Raise card, previews): ceiling, pre-money, dilution, closing odds,
 *  down round. */
export function raiseQuote(s: GameStateV2, ask: number, opts: { anchor?: boolean; pitch?: Pitch; ipo?: boolean } = {}) {
  const k = opts.ipo ? 1 : PITCH[opts.pitch ?? 'base'].price;
  const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!opts.anchor, ipo: !!opts.ipo, priceMult: k });
  const over = Number.isFinite(ask) ? Math.max(0, ask / Math.max(0.01, c.max) - 1) : 0;
  const pre = Math.max(1, s.player.finance.valuation) * k * (1 - Math.min(0.6, 0.5 * over));
  const a = Number.isFinite(ask) ? ask : c.max;
  const last = lastPostMoney(s);
  return { ceiling: c, priceMult: k, pre, dilution: a / (pre + a), pClose: Math.exp(-over), down: last > 0 && pre < last, lastPost: last };
}

/** The anchor a raise names, if it may anchor (FIN4r, L5: only the partners `anchorPartners` offers; anything else is
 *  an error, never a silent 14% limit). */
function anchorOf(s: GameStateV2, p: P): { anchor: string } | string {
  const anchor = str(p, 'anchor', '');
  if (!anchor || anchorPartners(s).includes(anchor)) return { anchor };
  return `${anchor} cannot anchor a round now (anchors: ${anchorPartners(s).join(', ') || 'none'})`;
}

/** The raise a set of params describes: ask (default the ceiling), anchor, pitch and the quote at that ask. */
function raiseOf(s: GameStateV2, p: P) {
  const a = anchorOf(s, p);
  const anchor = typeof a === 'string' ? '' : a.anchor;
  const { type, pitch } = raiseTerms(s, p);
  const q = raiseQuote(s, Number.POSITIVE_INFINITY, { anchor: !!anchor, pitch });
  const ask = num(p, 'ask', q.ceiling.max);
  return { anchor, type, pitch, ask, r: raiseQuote(s, ask, { anchor: !!anchor, pitch }) };
}

/** FIN3a (spec §7.3): no dilution vote; a round priced below the last post-money is a down round and needs the board. */
function raiseVote(s: GameStateV2, p: P) {
  const { r } = raiseOf(s, p);
  return r.down ? downRoundVote(s, `priced at $${r.pre.toFixed(0)}B pre-money, below the last round's $${r.lastPost.toFixed(0)}B post`) : undefined;
}

const raise: ActionDef = {
  id: 'fin.raise', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Raise',
  available: (s) => divisionBlock(s) ?? canRaise(s),
  vote: raiseVote,
  preview(s, p) {
    const { type, pitch, ask, r } = raiseOf(s, p);
    const th = makeThesis(s, type, pitch);
    const exposure: CostLine[] = [];
    const costs: CostLine[] = [{ currency: 'dilution', amount: Math.round(r.dilution * 1000) / 10 }];
    if (r.down) costs.push({ currency: 'boardConf', amount: downRoundHit(s), target: 'down round: priced below the last round' }, ...voteCost(raiseVote(s, p), bool(p, 'force')));
    if (r.pClose < 1) exposure.push({ currency: 'cash', amount: -ask, probability: Math.round((1 - r.pClose) * 100) / 100, lagDays: nextQDays(s) });
    if (typeof th !== 'string') {
      // The promise: judged 12 months after the close; at most full weight (it falls if you raise again before then).
      const lag = Math.max(1, promiseDeadline(s, s.time.day + nextQDays(s)) - s.time.day);
      exposure.push({ currency: 'credibility', amount: PROMISE_RESULT.missCred, lagDays: lag, target: `promise of ${describeTarget(th)} missed by over 20% (× weight)` });
      exposure.push({ currency: 'boardConf', amount: Math.round(PROMISE_RESULT.missBoard * moodWeight(s, 'results') * 10) / 10, lagDays: lag, target: 'if the promise is missed (× weight)' });
      exposure.push({ currency: 'credibility', amount: PROMISE_RESULT.metCred, lagDays: lag, target: 'if the promise is met (× weight)' });
    }
    return { costs, gains: roundCashLines(s, ask, s.time.day + nextQDays(s)), exposure };
  },
  apply(s, ctx, p) {
    const a = anchorOf(s, p);
    if (typeof a === 'string') return a;
    const { anchor } = a;
    const { type, pitch } = raiseTerms(s, p);
    const th = makeThesis(s, type, pitch);
    if (typeof th === 'string') return th;
    const k = PITCH[pitch].price;
    const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!anchor, priceMult: k });
    const ask = Math.max(0.1, num(p, 'ask', c.max));
    const no = voteGate(ctx, raiseVote(s, { ...p, ask }), bool(p, 'force'));
    if (no) return no;
    startRaise(s, ctx, ask, { ...(anchor ? { anchor } : {}), thesis: th, priceMult: k });
  },
};

// ───────────────────────────── IPO (FINANCE-V3 §2.6): one time, its own action ─────────────────────────────

const ipo: ActionDef = {
  id: 'fin.ipo', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'IPO',
  available: (s) => divisionBlock(s) ?? canIpo(s),
  preview(s, p) {
    const q = raiseQuote(s, Number.POSITIVE_INFINITY, { ipo: true });
    const ask = num(p, 'ask', q.ceiling.max);
    const r = raiseQuote(s, ask, { ipo: true });
    const dual = bool(p, 'dualClass');
    const costs: CostLine[] = [{ currency: 'dilution', amount: Math.round(r.dilution * 1000) / 10, target: 'sold to public holders' }];
    const gains: CostLine[] = roundCashLines(s, ask, s.time.day + nextQDays(s), true);
    const exposure: CostLine[] = [];
    if (dual) {
      gains.push({ currency: 'freedom', amount: 1, target: 'dual-class: founder votes keep control (you can force board decisions)' });
      // FIN4r (L4): a discount on the valuation mark, not cash. FIN5a: the factor is on the lab's weight in the story
      // share, so the valuation falls by 1 − k / (k·share + 1 − share) at today's share.
      const sh = s.capital.ws3?.playerShare ?? 0;
      const drop = 1 - DUAL_CLASS_GOV / (DUAL_CLASS_GOV * sh + 1 - sh);
      exposure.push({ currency: 'valuation', amount: -Math.round(drop * s.player.finance.valuation), target: `governance ×${DUAL_CLASS_GOV} on your share at every mark (−${(drop * 100).toFixed(1)}% of the valuation at today's share; no cash moves)` });
    } else if (founderControl(s)) costs.push({ currency: 'freedom', amount: -1, target: 'founder control ends: no more forcing board decisions' });
    costs.push({ currency: 'freedom', amount: -1, target: 'a listing independent joins the board' });
    if (r.pClose < 1) exposure.push({ currency: 'cash', amount: -ask, probability: Math.round((1 - r.pClose) * 100) / 100, lagDays: nextQDays(s) });
    return { costs, gains, exposure };
  },
  apply(s, ctx, p) {
    const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { ipo: true });
    const ask = Math.max(0.1, num(p, 'ask', c.max));
    startRaise(s, ctx, ask, { ipo: true, dualClass: bool(p, 'dualClass') });
  },
};

// ───────────────────────────── Repriced round: the player decides (LIMITS: no silent pull) ─────────────────────────────

const repricedAvail = (s: GameStateV2) => (s.player.finance.ws3?.repricedRound ? true : 'No repriced round to decide on');

/** A repriced round below the last post-money is a down round: it needs the board (spec §7.3). */
function repricedVote(s: GameStateV2) {
  const r = s.player.finance.ws3?.repricedRound;
  if (!r || r.pre >= (r.lastPost || lastPostMoney(s))) return undefined;
  return downRoundVote(s, `repriced to ${r.pre.toFixed(0)}B pre-money, below the last round's ${(r.lastPost || lastPostMoney(s)).toFixed(0)}B post`);
}

const acceptRound: ActionDef = {
  id: 'fin.acceptRepriced', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Accept round',
  available: repricedAvail,
  vote: repricedVote,
  preview(s, p) {
    const r = s.player.finance.ws3?.repricedRound;
    const pre = r?.pre ?? Math.max(1, s.player.finance.valuation);
    const ask = r ? closingAsk(r) : 0; // a repriced IPO still sells at most 5% (FIN3b)
    const down = !r || pre < (r.lastPost || lastPostMoney(s));
    return {
      costs: [{ currency: 'dilution', amount: Math.round((ask / (pre + ask || 1)) * 1000) / 10 }, ...(down ? [{ currency: 'boardConf' as const, amount: downRoundHit(s), target: 'down round' }] : []), ...voteCost(repricedVote(s), bool(p, 'force'))],
      gains: roundCashLines(s, ask, s.time.day, !!r?.ipo), // closes now: half now and a tranche for a large round (H3)
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const no = voteGate(ctx, repricedVote(s), bool(p, 'force'));
    if (no) return no;
    return acceptRepriced(s, ctx);
  },
};

const pullRound: ActionDef = {
  id: 'fin.pullRepriced', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Pull round',
  available: repricedAvail,
  preview(s) {
    const r = s.player.finance.ws3?.repricedRound;
    return { costs: [{ currency: 'cash', amount: -(r?.ask ?? 0), target: 'money you do not raise' }], gains: [{ currency: 'dilution', amount: 0, target: 'no dilution' }, { currency: 'boardConf', amount: 0, target: 'no down-round hit, no vote' }], exposure: [] };
  },
  apply: (s, ctx) => pullRepriced(s, ctx),
};

const downRound: ActionDef = {
  id: 'fin.downRound', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Down round',
  available: (s) => divisionBlock(s) ?? (s.player.finance.state === 'distress' || s.player.finance.state === 'tight' ? true : 'Only when runway is tight or in distress'),
  vote: (s) => downRoundVote(s, `a rescue round at ${Math.round(DOWN_PRICE.lo * 100)}–${Math.round(DOWN_PRICE.hi * 100)}% of the valuation`),
  // FIN4r (L1): the price is drawn at the close in the range, so the preview shows the range; it is a down round
  // whatever the last round was (mood −15 at this board's weight; anti-dilution only below a prior round's post-money);
  // paid in full now (no tranche).
  preview(s, p) {
    const V = Math.max(1, s.player.finance.valuation);
    const amt = downRoundSize(s);
    const dil = (k: number) => Math.round((amt / (V * k + amt)) * 1000) / 10;
    const last = lastPostMoney(s);
    const exposure: CostLine[] = [];
    if (last > V * DOWN_PRICE.lo) {
      const o = s.player.finance.ownership;
      const outside = 1 - (o.founder + o.mission) * (1 - amt / (V * DOWN_PRICE.lo + amt));
      const anti = Math.min(0.1, 0.2 * Math.max(0, (last - V * DOWN_PRICE.lo) / last) * outside);
      exposure.push({ currency: 'dilution', amount: Math.round(anti * 1000) / 10, target: `anti-dilution shares to prior investors, up to (priced below the last round's $${last.toFixed(0)}B post-money)` });
    }
    return {
      costs: [{ currency: 'dilution', amount: dil(DOWN_PRICE.lo), target: `priced at ${Math.round(DOWN_PRICE.lo * 100)}–${Math.round(DOWN_PRICE.hi * 100)}% of the valuation ($${(V * DOWN_PRICE.lo).toFixed(0)}–${(V * DOWN_PRICE.hi).toFixed(0)}B pre-money): ${dil(DOWN_PRICE.hi)}–${dil(DOWN_PRICE.lo)}% dilution` }, { currency: 'boardConf', amount: downRoundHit(s), target: 'down round' }, ...voteCost(downRoundVote(s, ''), bool(p, 'force'))],
      gains: [{ currency: 'cash', amount: amt, target: 'now, in full (no tranche)' }],
      exposure,
    };
  },
  apply(s, ctx, p) {
    const no = voteGate(ctx, downRoundVote(s, 'a rescue round'), bool(p, 'force'));
    if (no) return no;
    const amt = downRoundSize(s);
    const pre = s.player.finance.valuation * ctx.rng('finance').range(DOWN_PRICE.lo, DOWN_PRICE.hi);
    bookRound(s, ctx, amt, pre, { source: 'Rescue round', full: true, down: true });
  },
};
/** The distress down round's price: the valuation × 0.5–0.7, drawn at the close [R15]. */
export const DOWN_PRICE = { lo: 0.5, hi: 0.7 } as const;
function downRoundSize(s: GameStateV2) {
  return Math.max(10, Math.min(0.15 * s.player.finance.valuation * 0.6, 3 * Math.max(0, runwayOf(s).burnQ)));
}

/** A round's tranche condition in words (revenue: set from the run-rate at the close, 1.2× it). */
function roundConditionWords(cond: string): string {
  const [k, v] = cond.split(':');
  return k === 'revenue' ? `revenue run-rate reaches $${Number(v).toFixed(0)}B/yr (${LARGE_ROUND.revenueX}× the run-rate at the close)` : conditionWords(cond);
}

/** The cash lines of a round closing on `closeDay` (FIN4r, H3): what lands at the close and, for a round of $20B or
 *  more (not an IPO or a distress down round: `full`), the conditional tranche with its amount, condition and
 *  deadline, exactly as `bookRound` books them. */
export function roundCashLines(s: GameStateV2, amount: number, closeDay: number, full = false): CostLine[] {
  const sp = roundSplit(s, amount, { full, closeDay });
  const out: CostLine[] = [{ currency: 'cash', amount: sp.now, lagDays: Math.max(0, closeDay - s.time.day), target: sp.tranche ? `at the close: half (a round of $${LARGE_ROUND.min}B or more pays the rest as a tranche)` : 'at the close' }];
  if (sp.tranche) out.push({ currency: 'cash', amount: sp.tranche.amount, lagDays: Math.max(0, sp.tranche.dueDay - s.time.day), target: `tranche: if ${roundConditionWords(sp.tranche.condition)} by ${qName(s, sp.tranche.deadline)}, else it lapses and its shares are cancelled` });
  return out;
}

// ───────────────────────────── Partners (FINANCE-V3 §6; FIN4a) ─────────────────────────────

const qName = (s: GameStateV2, day: number) => {
  const d = dateOfDay(s.time.startDate, day);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
};
/** A tranche condition in words ('gw:1.7' → '1.7 GW online'). */
export function conditionWords(cond: string): string {
  const [k, v] = cond.split(':');
  if (k === 'gw') return `${Number(v).toFixed(1)} GW online in your own sites`;
  if (k === 'revenue') return `$${Number(v).toFixed(0)}B/yr revenue run-rate`;
  if (cond === 'ipo') return 'an IPO';
  if (cond === 'recapitalisation') return 'the recapitalisation';
  return cond;
}

/** Preview of a partner's terms (Partners card, rescue): everything it gives and every string, before you sign. */
export function dealPreview(s: GameStateV2, t: PartnerTerms): Preview {
  const V = Math.max(10, s.player.finance.valuation);
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const exposure: CostLine[] = [];
  const eq = termsEquity(t);
  const stake0 = s.player.finance.ownership.strat[t.partner] ?? 0;
  const dil = t.rescue ? partnerStakeAfter(s, t) - stake0 : eq / (V + eq);
  if (dil > 0) costs.push({ currency: 'dilution', amount: Math.round(dil * 1000) / 10, target: t.rescue ? `${t.partner} topped up to ${Math.round((t.stake ?? 0) * 100)}%` : t.tranches.length ? 'now and in tranches, at today\'s valuation' : 'at today\'s valuation', ...(t.equityNow <= 0 && t.tranches.length ? { lagDays: Math.max(0, t.tranches[0].dueDay - s.time.day) } : {}) });
  if (t.equityNow > 0) gains.push({ currency: 'cash', amount: t.equityNow, target: 'now' });
  for (const x of t.tranches) gains.push({ currency: 'cash', amount: x.amount, lagDays: Math.max(0, x.dueDay - s.time.day), target: `tranche: if ${conditionWords(x.condition)} by ${qName(s, x.deadline)}, else it lapses` });
  const sp = t.supply;
  if (sp) {
    const lag = Math.max(0, dayOfQuarter(s.time.startDate, sp.startQ) - s.time.day);
    const cuts = `path −${Math.round(sp.firmDiscount * 100)}% firm${sp.partnerDiscount > 0 ? ` −${Math.round(sp.partnerDiscount * 100)}% partner` : ''}${sp.costMult !== undefined ? `, custom chips at ${Math.round(sp.costMult * 100)}% of an H100e` : ''}`;
    if (sp.kind === 'cloud') gains.push({ currency: 'compute', amount: sp.h100e, lagDays: lag, target: `cloud for ${sp.quarters / 4} y, served first in a shortage` });
    else gains.push({ currency: 'compute', amount: sp.h100e * sp.quarters, lagDays: lag + 91, target: sp.kind === 'asic' ? `custom chips over ${sp.quarters} quarters, a separate supply pool` : `its chips over ${sp.quarters} quarters; +${MARKET.rationW.strategic} allocation weight on every chip order while it supplies` });
    // FIN5a: a doubted buyer prepays part of the first delivery (supplier terms, spec §5).
    if (sp.prepaid) costs.push({ currency: 'cash', amount: -sp.prepaid, target: `prepaid now: ${Math.round(supplierTerms(s).firstDelivery * 100)}% of the first delivery (supplier terms: your share of investor money and runway)` });
    costs.push({ currency: 'cash', amount: -sp.perQ[0], lagDays: lag, target: `first of ${sp.quarters} quarterly payments (take-or-pay; ${cuts})` });
    costs.push({ currency: 'cash', amount: -sp.perQ[sp.perQ.length - 1], lagDays: lag + (sp.quarters - 1) * 91, target: `last payment (expected path); $${sp.total.toFixed(1)}B in all` });
    if (sp.kind === 'asic') costs.push({ currency: 'progress', amount: -Math.round((1 - PARTNER_TERMS.asic.researchMult) * 100), unit: '%', lagDays: 0, target: `research speed for ~${(PARTNER_TERMS.asic.migrationDays / 91).toFixed(1)} quarters while you migrate` });
  }
  if (t.strings.revenueShare) costs.push({ currency: 'revenue', amount: -t.strings.revenueShare * s.player.finance.revenueRun, target: `${Math.round(t.strings.revenueShare * 100)}% revenue share per year for ${t.years} y` });
  if (t.strings.exclusivity) {
    const rivals = partnerDef(t.partner)?.competitors ?? [];
    exposure.push({ currency: 'freedom', amount: -1, target: `exclusivity: no deals with ${rivals.length ? rivals.join(', ') : 'its competitors'}` });
  }
  // FIN4b: what IP access costs, in plain words (the money each string adds is in the cash lines and on its option).
  const ip = t.strings.ipAccess;
  if (ip) {
    const lead = leadEstimate(s, ip.lab);
    const name = t.options.ipAccess.labName ?? ip.lab;
    const days = PARTNER_TERMS.strings.ipCloseYr * Math.max(0, lead);
    const below = s.player.board.preset === 'pbcTrust' && !ip.trust ? "; capability-threshold models stay out without the trust's yes" : '';
    costs.push({ currency: 'leadDays', amount: -Math.round(days), target: `IP access: ${name} (${t.partner}'s lab) licenses your models and closes ~${Math.round(PARTNER_TERMS.strings.ipCloseYr * 100)}% of your lead a year for ${t.years} y (${lead > 0 ? `≈${Math.round(days)} days a year of your estimated ${Math.round(lead)}-day lead` : `you are not ahead of ${name} now`}${below})` });
  }
  if (t.politics) costs.push({ currency: 'scrutiny', amount: t.politics.scrutiny, target: 'foreign money' }, { currency: 'trust', amount: t.politics.congress, target: 'congress' }, { currency: 'freedom', amount: -1, target: `government security demand +${t.politics.securityDemand}` });
  if (t.rescue) costs.push({ currency: 'freedom', amount: -(t.strings.boardVotes ?? 0), target: `a board seat with ${t.strings.boardVotes} votes for ${t.partner}, and exclusivity` });
  if (!costs.length) costs.push({ currency: 'staffTime', amount: 1 });
  return { costs, gains, exposure };
}

/** The partner and choices a set of params describes (default: the first partner that will deal, its first supply, no
 *  optional strings). Params: `partner`, `supply`, `exclusive`, `ipAccess` (FIN4b). */
function partnerOf(s: GameStateV2, p: P): PartnerChoice & { partner: string } {
  const want = str(p, 'partner', '');
  const partner = want || partnerOffers(s).find((o) => !o.blocked)?.partner || PARTNER_DEFS[0].id;
  const sp = str(p, 'supply', '') as PartnerSupply;
  return { partner, ...(sp && supplyOptions(partner).includes(sp) ? { supply: sp } : {}), exclusive: bool(p, 'exclusive'), ipAccess: bool(p, 'ipAccess') };
}
const termsOf = (s: GameStateV2, p: P) => {
  const { partner: who, ...c } = partnerOf(s, p);
  return partnerTerms(s, who, c);
};

/** A partner's take-or-pay above 3× revenue needs the board (spec §7.3); a deal handing it control needs the trust (PBC
 *  + trust, §7.2) and the board. The vote shown is the first that fails, else the first needed. */
const partnerVote = (s: GameStateV2, p: P) => firstVote(dealVotes(s, termsOf(s, p)));

const partner: ActionDef = {
  id: 'fin.partner', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Sign partner',
  available: (s) => divisionBlock(s) ?? notInsolvent(s),
  vote: partnerVote,
  preview(s, p) {
    const v = dealPreview(s, termsOf(s, p));
    // FIN4r (L2): every failing vote founder control forces costs its −20 (signPartner forces each in turn).
    return { ...v, costs: [...v.costs, ...dealVotes(s, termsOf(s, p)).flatMap((x) => voteCost(x, bool(p, 'force')))] };
  },
  apply(s, ctx, p) {
    const { partner: who, ...c } = partnerOf(s, p);
    const err = signPartner(s, ctx, who, { ...c, force: bool(p, 'force') });
    if (err) {
      ctx.log('finance', err, 2);
      return err;
    }
  },
};

/** One strategic rescue per year [D, M4]: a second rescue inside a year is a sale of control in all but name. */
export const RESCUE_COOLDOWN_D = 365;

/** A rescue (spec §6.2): the rescuing partner's terms in distress and their votes (a major decision, §7.3; past 50% also
 *  a sale of control). */
const rescueTerms = (s: GameStateV2) => {
  const who = rescuePartner(s);
  return who ? partnerTerms(s, who, { rescue: true }) : undefined;
};
const rescueVote = (s: GameStateV2) => {
  const t = rescueTerms(s);
  return t ? firstVote(dealVotes(s, t)) : undefined;
};

const rescue: ActionDef = {
  id: 'fin.rescue', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Rescue',
  available: (s) => {
    const f = s.player.finance;
    const div = divisionBlock(s);
    if (div) return div;
    if (f.state !== 'distress') return 'Only in distress';
    if (f.ws3?.lastRescueDay !== undefined && s.time.day - f.ws3.lastRescueDay < RESCUE_COOLDOWN_D) return 'Partners will not rescue you twice in a year';
    return rescuePartner(s) ? true : 'No partner will rescue you (blocked by exclusivity or anchoring another lab)';
  },
  vote: rescueVote,
  preview(s, p) {
    const t = rescueTerms(s);
    const v = t ? dealPreview(s, t) : { costs: [{ currency: 'freedom' as const, amount: -2 }], gains: [], exposure: [] };
    return { ...v, costs: [...v.costs, ...(t ? dealVotes(s, t).flatMap((x) => voteCost(x, bool(p, 'force'))) : [])] };
  },
  apply(s, ctx, p) {
    const who = rescuePartner(s);
    if (!who) return 'No partner will rescue you';
    return signPartner(s, ctx, who, { rescue: true, force: bool(p, 'force') });
  },
};

// ───────────────────────────── Debt ─────────────────────────────

/** The draw a set of params describes (kind, amount within the headroom). */
function drawOf(s: GameStateV2, p: P) {
  const kind = str(p, 'kind', 'revolver') as Debt['kind'];
  const h = debtHeadroom(s, kind);
  return { kind, amt: Math.min(num(p, 'amount', h.max), h.max) };
}
/** FIN3a (spec §7.3): debt above 3× revenue needs the board (the 20%-of-revenue vote is gone). */
const drawVote = (s: GameStateV2, p: P) => debtVote(s, drawOf(s, p).amt);
const COVENANT_OF: Partial<Record<Debt['kind'], string>> = { revolver: 'covenant: keep ⅓ of the line in cash at quarter ends', gpuTerm: 'covenant: chips ≥ 1.2× the loan or a cash sweep', bond: 'incurrence covenant on new debt' };

const draw: ActionDef = {
  id: 'fin.drawDebt', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Borrow',
  vote: drawVote,
  available: (s) => {
    const b = divisionBlock(s);
    if (b) return b;
    const h = (['revolver', 'gpuTerm', 'bond'] as const).map((k) => debtHeadroom(s, k));
    return h.some((x) => x.max > 0) ? true : h[0].why ?? 'No debt capacity';
  },
  preview(s, p) {
    const { kind, amt } = drawOf(s, p);
    const rate = newDebtRatePct(s, kind);
    const exposure: CostLine[] = [{ currency: 'cash', amount: -amt, target: 'covenant: called if breached', probability: 0.05 }];
    // FIN3a: borrowing no longer moves board confidence (not a named source, spec §7.4); the covenant is the cost.
    return { costs: [{ currency: 'freedom', amount: -1, target: COVENANT_OF[kind] ?? 'covenants' }, { currency: 'cash', amount: -(amt * rate) / 100, target: 'interest per year' }, ...voteCost(drawVote(s, p), bool(p, 'force'))], gains: [{ currency: 'cash', amount: amt }], exposure };
  },
  apply(s, ctx, p) {
    const { kind, amt } = drawOf(s, p);
    if (amt <= 0) return;
    const no = voteGate(ctx, drawVote(s, p), bool(p, 'force'));
    if (no) return no;
    drawDebt(s, ctx, kind, amt);
  },
};

const repay: ActionDef = {
  id: 'fin.repayDebt', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Repay',
  available: (s) => (s.player.finance.debts.some((d) => d.drawn > 0) ? true : 'No drawn debt'),
  preview(s, p) {
    const drawn = s.player.finance.debts.reduce((a, d) => a + d.drawn, 0);
    const amt = Math.min(num(p, 'amount', drawn), drawn, Math.max(0, s.player.finance.cash));
    return { costs: [{ currency: 'cash', amount: -amt }], gains: [{ currency: 'freedom', amount: 1, target: 'less interest, more covenant headroom' }], exposure: [] };
  },
  apply(s, ctx, p) {
    const drawn = s.player.finance.debts.reduce((a, d) => a + d.drawn, 0);
    repayDebt(s, ctx, num(p, 'amount', drawn), str(p, 'id', '') || undefined);
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

/** Give the critics a seat (spec §7.5, FIN3b): below 40 confidence, once a year, the side driving the decline gets a
 *  director for good: +15 now, and the new seat's stance and mood weights move every later vote and mood change. */
const critics: ActionDef = {
  id: 'fin.critics', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Seat the critics',
  available: criticsAvailable,
  preview(s) {
    const c = criticsSide(s);
    const x = criticsSeat(s);
    const after = withCriticsSeat(s);
    const o = criticsOusterShift(s);
    const line = (v?: number) => (v === undefined ? 'no majority' : `passes below ${Math.round(v)}`);
    const shifts = MOOD_SOURCES.map((m) => ({ m, a: moodWeight(s, m), b: moodWeight(after, m) })).filter((d) => Math.abs(d.b - d.a) >= 0.005)
      .map((d) => `${MOOD_LABEL[d.m].toLowerCase()} ×${d.a.toFixed(2)} → ×${d.b.toFixed(2)}`).join(', ');
    return {
      costs: [{ currency: 'freedom', amount: -1, target: `${x.holder} joins for good (${c.side === 'mission' ? 'a mission seat' : 'an investor seat'}): ${c.why}` }],
      gains: [{ currency: 'boardConf', amount: CRITICS.gain, target: 'now' }],
      exposure: [
        ...(shifts ? [{ currency: 'boardConf' as const, amount: 0, target: `the board leans that way from now on: ${shifts}` }] : []),
        { currency: 'freedom', amount: o.after !== undefined && (o.before === undefined || o.after > o.before) ? -1 : 0, target: `ouster vote on today's grievance: ${line(o.before)} → ${line(o.after)}` },
      ],
    };
  },
  apply: (s, ctx) => giveCriticsSeat(s, ctx),
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
      // FIN4r (H3): a round's tranche cut to $10B cancels the shares of the money that will not come.
      cancelTrancheShares(s, t, 1 - Math.min(10, t.amount) / Math.max(1e-9, t.amount));
      delete t.shares;
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

/** Quarterly chip tranches are firm commitments: above 3× revenue they need the board (spec §7.3). Spot and single
 *  batches are compute orders, never voted on, except how they are paid (FIN4r, M2): a chip loan is debt (the debt
 *  vote on what it borrows, above 3× revenue) and a lease a 5-year firm obligation (the commitments vote on its first
 *  year, as for any firm contract). */
function chipsVote(s: GameStateV2, p: P) {
  const c = chipParams(p);
  const qt = chipQuote(s, c.term, c.qty, c);
  if (c.term >= 2) return commitmentsVote(s, (qt.now + qt.later) * 4);
  if (c.pay === 'loan') return debtVote(s, Math.min(qt.later * DEBT_SIZING.chipLTV * DEBT_SIZING.chipHaircut, debtHeadroom(s, 'gpuTerm').max));
  if (c.pay === 'lease') {
    const opt = payOptions(s, qt.later, 'chips').find((o) => o.id === 'lease');
    return opt && !opt.blocked ? commitmentsVote(s, opt.perYear) : undefined;
  }
  return undefined;
}

const buyChips: ActionDef = {
  id: 'cmp.buyChips', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Buy chips',
  vote: chipsVote,
  available: notInsolvent,
  preview(s, p) {
    const c = chipParams(p);
    const qt = chipQuote(s, c.term, c.qty, c);
    const costs: CostLine[] = [];
    if (qt.kind === 'lta') {
      if (qt.now > 0) costs.push({ currency: 'cash', amount: -qt.now, target: `prepaid now: ${Math.round(qt.prepay * 100)}% of the first tranche (supplier terms)` });
      costs.push({ currency: 'cash', amount: -qt.later, lagDays: lagTo(s, qt.dueQ), target: `first of ${qt.quarters} quarterly payments (take-or-pay)` });
      costs.push({ currency: 'cash', amount: -(c.qty * qt.prices![qt.quarters - 1]) / 1e6, lagDays: lagTo(s, qt.dueQ + qt.quarters - 1), target: 'last payment (expected path)' });
    } else {
      if (qt.now > 0) costs.push({ currency: 'cash', amount: -qt.now, target: `deposit now (${Math.round(qt.prepay * 100)}% of the order)` }); // FIN6c: the supplier's minimum has its own chip on the card
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
    costs.push(...voteCost(chipsVote(s, p), bool(p, 'force')));
    return { costs, gains: [{ currency: 'compute', amount: qt.kind === 'lta' ? c.qty * qt.quarters : c.qty, lagDays: lagTo(s, qt.dueQ + 1) }], exposure };
  },
  apply(s, ctx, p) {
    const c = chipParams(p);
    const rate = c.pay === 'lease' ? leaseRate(s) : undefined;
    if (c.pay === 'lease' && rate === undefined) return leaseAvailable(s) as string;
    const no = voteGate(ctx, chipsVote(s, p), bool(p, 'force'));
    if (no) return no;
    placeOrder(s, ctx, c.term, c.qty, { ...c, ...(rate !== undefined ? { leaseRate: rate } : {}) });
  },
};

// ───────────────────────────── Compute: Rent compute (spec §5) ─────────────────────────────

/** Rent parameters: `term` in quarters (1 = a one-quarter spot rental; 4–20 = a contract from next quarter), `firm`
 *  (default) or cancellable; `provider` (default the neocloud). */
function rentParams(p: P) {
  return { h100e: Math.max(1e4, num(p, 'h100e', 0.5e6)), term: Math.max(1, Math.min(RENT_Q_MAX, Math.round(num(p, 'term', 4)))), firm: bool(p, 'firm', true), provider: str(p, 'provider', NEOCLOUD) };
}

/** A firm cloud contract is a firm commitment: above 3× revenue it needs the board (spec §7.3). Spot rentals and
 *  cancellable contracts are never voted on. */
function rentVote(s: GameStateV2, p: P) {
  const r = rentParams(p);
  if (r.term <= 1 || !r.firm) return undefined;
  return commitmentsVote(s, rentQuote(s, r.h100e, r.term, r.firm).perQ.slice(0, 4).reduce((a, b) => a + b, 0));
}

const rentCompute: ActionDef = {
  id: 'cmp.rentCompute', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Rent compute',
  vote: rentVote,
  available: notInsolvent,
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
    costs.push(...voteCost(rentVote(s, p), bool(p, 'force')));
    return { costs, gains: [{ currency: 'compute', amount: r.h100e, lagDays: lag }], exposure };
  },
  apply(s, ctx, p) {
    const r = rentParams(p);
    if (r.term <= 1) {
      const got = addSpotRental(s, r.h100e);
      ctx.log('finance', `Spot rental: ${(got / 1e3).toFixed(0)}k H100e for a quarter at $${s.market.rental.toFixed(2)}/h.`);
      return got > 0 ? undefined : 'No spot capacity left';
    }
    const no = voteGate(ctx, rentVote(s, p), bool(p, 'force'));
    if (no) return no;
    addCloud(s, ctx, r.h100e, r.term, r.provider, { firm: r.firm });
  },
};

// ───────────────────────────── Compute: sites (spec §4 payment options) ─────────────────────────────

/** The build card's options. Rent: cash only, no speed-ups and no community package. mw clamped to [100, source max]. */
function siteOpts(s: GameStateV2, p: P): SiteOpts {
  const asked = str(p, 'path', 'gas');
  const path = (SOURCES[asked as Site['path']] ? asked : 'gas') as Site['path'];
  const def = SOURCES[path];
  const mw = Math.max(SITE_MIN_MW, Math.min(def.maxMW, num(p, 'mw', Math.min(1000, def.maxMW))));
  if (path === 'rent') return { path, mw, crash: false, rush: false, fastTrack: false, community: false, pay: 'cash' };
  const pay = str(p, 'pay', 'cash') === 'lease' ? 'lease' : 'cash';
  const rate = pay === 'lease' ? leaseRate(s) : undefined;
  return {
    path, mw, crash: bool(p, 'crash'), rush: bool(p, 'rush'), fastTrack: bool(p, 'fastTrack'),
    community: bool(p, 'community', s.player.policies.communityBenefits), pay, ...(rate !== undefined ? { leaseRate: rate } : {}),
  };
}

const site: ActionDef = {
  id: 'cmp.newSite', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'New site',
  available: notInsolvent,
  preview(s, p) {
    const o = siteOpts(s, p);
    const capex = siteCapex(o);
    const odds = oppositionOdds(s, { path: o.path, crash: !!o.crash, communityPackage: !!o.community });
    const eta = siteLiveInQ(s, o) * 91;
    const H = (o.mw * 1000) / s.power.kWPerH100e;
    const exposure: CostLine[] = [];
    let costs: CostLine[];
    if (o.path === 'rent') costs = [{ currency: 'cash', amount: -(o.mw / 1000) * RENT.perGWYear, target: `rent per year × ${RENT.years} (non-cancellable)` }, { currency: 'cash', amount: -capex, target: 'network fit-out' }];
    else if (o.pay === 'lease') {
      const opt = payOptions(s, capex, 'site', siteSchedule(s, o)).find((x) => x.id === 'lease')!;
      costs = [{ currency: 'cash', amount: -opt.now, lagDays: eta, target: `capex, your ${Math.round((1 - CAPEX_LEASE.siteShare) * 100)}% share` }, { currency: 'cash', amount: -opt.perYear, lagDays: eta, target: `lease per year × ${opt.years} y from go-live (${((opt.rate ?? 0) * 100).toFixed(0)}%)` }];
      exposure.push({ currency: 'cash', amount: -CAPEX_LEASE.rvgShare * capex * CAPEX_LEASE.siteShare, target: 'residual-value guarantee if you walk away' });
    } else costs = [{ currency: 'cash', amount: -capex, lagDays: eta, target: 'capex on the build schedule' }];
    if (odds.block > 0) exposure.push({ currency: 'compute', amount: -H, probability: Math.round(odds.block * 100) / 100, target: 'blocked by local opposition' });
    if (odds.delay > 0) exposure.push({ currency: 'compute', amount: -H, probability: Math.round(odds.delay * 100) / 100, lagDays: 182, target: 'delayed 1–3 quarters' });
    return { costs, gains: [{ currency: 'compute', amount: H, lagDays: eta, target: 'MW to install chips' }], exposure };
  },
  apply(s, ctx, p) {
    const o = siteOpts(s, p);
    if (o.pay === 'lease' && o.leaseRate === undefined) return leaseAvailable(s) as string;
    newSite(s, ctx, o);
  },
};

/** Sites still able to take an upfront community package (in permitting, not yet rolled, not colocation). */
const packageable = (s: GameStateV2) => s.player.sites.filter((x) => x.stage === 'permitting' && !x.communityPackage && !x.ws3?.rolled && x.path !== 'rent');
/** Community package (spec §4; merges F1 and the per-site deal): with `siteId`, the upfront package for that site ($1B
 *  per GW of its size, block odds × 0.5); without, the company default: every site still permitting gets it now and every
 *  new site by default, with the pledge to pay our own power and grid costs (a relations commitment, kept from F1). */
const community: ActionDef = {
  id: 'cmp.community', verb: 'deal', system: 'compute', sphere: 'finance', owner: 'WS3', title: 'Community package',
  available: (s) => (!s.player.policies.communityBenefits || packageable(s).length ? true : 'Company default on; no site in permitting without a package'),
  preview(s, p) {
    const one = str(p, 'siteId', '');
    // FIN4r (L3): without a site, every site still permitting gets the package (as apply does), default on or off.
    const sites = one ? packageable(s).filter((x) => x.id === one) : packageable(s);
    const cost = sites.reduce((a, x) => a + (x.mw / 1000) * LEVERS.community.perGW, 0);
    const saved = sites.reduce((a, x) => a + ((x.mw * 1000) / s.power.kWPerH100e) * oppositionOdds(s, x).block * (1 - LEVERS.community.blockMult), 0);
    const costs: CostLine[] = [{ currency: 'cash', amount: -Math.max(cost, 0.01), lagDays: 0, target: `$${LEVERS.community.perGW}B per GW on ${sites.length} site${sites.length === 1 ? '' : 's'} (build schedule)` }];
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

// ───────────────────────────── Distress menu (E26) ─────────────────────────────

const renegotiate: ActionDef = {
  id: 'fin.renegotiate', verb: 'deal', system: 'finance', sphere: 'finance', owner: 'WS3', title: 'Renegotiate',
  available: (s) => {
    const f = s.player.finance;
    if (f.state !== 'distress' && f.state !== 'tight') return 'Only when runway is tight or in distress';
    if (f.ws3?.lastRenegotiationDay !== undefined && s.time.day - f.ws3.lastRenegotiationDay < 365) return 'Suppliers will renegotiate once a year';
    return true;
  },
  // FIN4r (H1): firm contracts on the expected path pay one ledger entry per quarter, so the deferral is per quarter of
  // payments (deferFirm): 35% of the next 4 quarters' firm payments, paid back at each contract's end. The preview is
  // what is deferred.
  preview(s) {
    const ds = deferFirm(s, RENEGOTIATE.defer, RENEGOTIATE.quarters, false);
    const sum = ds.reduce((a, d) => a + d.deferred, 0);
    const back = (d: { backQ: number }) => Math.max(0, dayOfQuarter(s.time.startDate, d.backQ) - s.time.day);
    const lag = sum > 0 ? Math.round(ds.reduce((a, d) => a + d.deferred * back(d), 0) / sum) : 0;
    const q1 = qOf(s) + 1;
    const span = ds.length ? `${qName(s, dayOfQuarter(s.time.startDate, Math.min(...ds.map((d) => d.backQ))))}–${qName(s, dayOfQuarter(s.time.startDate, Math.max(...ds.map((d) => d.backQ))))}` : '';
    return {
      costs: [{ currency: 'dilution', amount: RENEGOTIATE.warrants * 100, target: 'warrants to suppliers' }, ...(sum > 0 ? [{ currency: 'cash' as const, amount: -sum, lagDays: lag, target: `deferred, not forgiven: paid back after each contract's last payment (${span})` }] : [])],
      gains: [{ currency: 'cash', amount: sum, lagDays: nextQDays(s), target: `${Math.round(RENEGOTIATE.defer * 100)}% of ${ds.length} firm contract${ds.length === 1 ? '' : 's'}' payments in ${qName(s, dayOfQuarter(s.time.startDate, q1))}–${qName(s, dayOfQuarter(s.time.startDate, q1 + RENEGOTIATE.quarters - 1))} deferred` }],
      exposure: [],
    };
  },
  apply(s, ctx) {
    const f = s.player.finance;
    ensureWs3(s);
    const ds = deferFirm(s, RENEGOTIATE.defer, RENEGOTIATE.quarters, true);
    f.ws3.lastRenegotiationDay = s.time.day;
    issueWarrants(s, RENEGOTIATE.warrants);
    ctx.log('finance', `Suppliers accept a ${Math.round(RENEGOTIATE.defer * 100)}% deferral of the next ${RENEGOTIATE.quarters} quarters' firm payments ($${ds.reduce((a, d) => a + d.deferred, 0).toFixed(1)}B, paid back at each contract's end) for warrants.`);
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

export const FINANCE_ACTIONS: ActionDef[] = [
  raise, ipo, partner, draw, repay, recap, refuseRecap, critics,
  buyChips, rentCompute, site, community,
  downRound, rescue, renegotiate, sell, cancel, acceptRound, pullRound,
];



