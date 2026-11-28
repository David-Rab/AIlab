// Strategic partners (FINANCE-V3 §6.1–§6.3; FIN4a): one offer flow. Each partner's terms are computed live from the
// company and the market and shown in full before you sign (`partnerTerms`); signing books exactly those terms
// (`signPartner`). Two kinds: a hyperscaler (non-voting equity in tranches, capped at 15%, plus cloud or custom chips at
// a discount, against a take-or-pay commitment of 4 × its equity in dollars over 6 years, booked a firm contract a year
// so the capacity it buys grows as prices fall) and a chip vendor (equity per GW of its chips you buy, which is the
// commitment). A tranche lands as that commitment is paid: 'spent:<partner>:<$B>' counts the payments the ledger made to
// the partner since signing. A rescue (distress only) is the same flow, priced by distress. Every supply price follows
// the expected market path (FIN1) less the firm discount and the partner's own.
// FIN4b (spec §6.1 strings): up to 3 partners at once; exclusivity and IP access are optional strings that add money
// (shown on the offer, under the stake cap) and both end with the deal: exclusivity is offered only while a competitor of
// the partner could offer you something, and only deals still running block; IP access lets the partner's affiliated
// rival lab close ~10% a year of your capability lead (npc/shocks.ts ipAccess, a line in the rivals' day), its money
// scaling with that lead, behind the PBC + trust's transfer vote for a capability-threshold model.
// Owner: WS3.
import { AFFILIATE_KIND, firmDiscount, PARTNER_DEFS, PARTNER_TERMS, partnerDef, type PartnerSupply } from '../../../data/v2/deals';
import { dayOfQuarter } from '../core/time';
import type { BoardVote, Day, GameStateV2, LabId, PartnerOption, PartnerTerms, RivalLab, StrategicDeal, SystemCtx } from '../types';
import { addCloud, chipQuote, placeOrder, rentQuote } from '../compute/orders';
import { boardVote, commitmentsVote, voteGate } from './board';
import { missionPowers } from './control';
import { controlVotes, ipTransferVote } from './charter';
import { issue, partnerEquityIn, stakeRoom } from './equity';
import { leadEstimate } from './observe';
import { ensureWs3 } from './ext';
import { paidTo, qOf } from './ledger';
import { divisionBlock } from './parent';
import { runwayOf } from './runway';
import { dealCutProjections, type CutProjection } from './distribution';

export const SUPPLY_LABEL: Record<PartnerSupply, string> = { cloud: 'cloud capacity', asic: 'custom chips', chips: 'its chips' };

/** Partners whose running exclusivity blocks a deal with `partner`: a deal past its `until` blocks nothing. */
export function vetoesOf(s: GameStateV2, partner: string): string[] {
  const out: string[] = [];
  for (const d of s.player.finance.deals) {
    if (!d.strings.exclusivity || d.partner === partner || d.until <= s.time.day) continue;
    if (partnerDef(d.partner)?.competitors.includes(partner)) out.push(d.partner);
  }
  return out;
}

const stakeOf = (s: GameStateV2, partner: string) => s.player.finance.ownership.strat[partner] ?? 0;
const V0 = (s: GameStateV2) => Math.max(10, s.player.finance.valuation);

/** Equity a hyperscaler may still buy ($B at today's valuation): its stake, tranches included, stays at or under 15%
 *  of the company (non-voting, capped [R21 B2]). */
export const hyperscalerRoom = (s: GameStateV2, partner: string) => stakeRoom(V0(s), stakeOf(s, partner), PARTNER_TERMS.hyperscaler.stakeCap);

/** A partner's deal signed in the game (not a stake from before the start), if any: one deal per partner (FIN4a). */
export const dealWith = (s: GameStateV2, partner: string) => s.player.finance.deals.find((d) => d.partner === partner && !d.legacy);

const ST = PARTNER_TERMS.strings;

/** Your partners (FIN4b): every partner you signed a deal with in the game, rescue included, in signing order. Deals run
 *  6 years or more (longer than the game) and a cheque makes a holder, so a partner counts from signing. Stakes from
 *  before the start do not count. At most PARTNER_TERMS.strings.maxPartners (3). */
export const partnersNow = (s: GameStateV2): string[] => [...new Set(s.player.finance.deals.filter((d) => !d.legacy).map((d) => d.partner))];

/** A partner's affiliated lab now (data/v2/deals.ts AFFILIATE_KIND): the active big-tech NPC lab, for a partner marked
 *  `inHouse`; none otherwise. */
export function affiliatedLab(s: GameStateV2, partner: string): RivalLab | undefined {
  if (!partnerDef(partner)?.inHouse) return undefined;
  return s.rivals.find((r) => r.core.status === 'active' && r.npc.kind === AFFILIATE_KIND);
}
const labName = (s: GameStateV2, lab: LabId) => s.rivals.find((r) => r.core.id === lab)?.core.name ?? lab;

/** Why exclusivity is not on offer from `partner` now, or undefined: it excludes a competitor, so there must be one that
 *  could offer you something now (`partnerBlocker`); one whose competitor is already your partner will not ask for it. */
export function exclusiveBlocker(s: GameStateV2, partner: string): string | undefined {
  const p = partnerDef(partner);
  if (!p?.competitors.length) return `${partner} has no competitors to exclude`;
  const c = p.competitors.find((x) => dealWith(s, x));
  if (c) return `You already partner with ${c}, its competitor`;
  if (p.competitors.every((x) => partnerBlocker(s, x))) return `${p.competitors[0]} has nothing to offer you now, so there is nothing to exclude`;
  return undefined;
}
/** Months of lead over the partner's affiliated lab (your estimate; 0 when level or behind). */
export const leadMonths = (s: GameStateV2, lab: LabId) => Math.max(0, leadEstimate(s, lab)) / 30.4;
/** How much of its full money IP access earns at your lead: ⅙ per month of lead up to `ipFullLeadMonths`. */
export const ipLeadScale = (s: GameStateV2, lab: LabId) => Math.min(1, leadMonths(s, lab) / ST.ipFullLeadMonths);
/** Why IP access is not on offer from `partner` now, or undefined (hyperscalers with an affiliated lab only, and only
 *  while you have a lead to license). */
export function ipBlocker(s: GameStateV2, partner: string): string | undefined {
  if (partnerDef(partner)?.kind !== 'hyperscaler') return 'Only a hyperscaler licenses your models';
  const lab = affiliatedLab(s, partner);
  if (!lab) return `${partner} has no in-house lab to license your models to`;
  return leadMonths(s, lab.core.id) > 0 ? undefined : 'You have no lead to license';
}

/** IP access the PBC + trust must vote on: a licence that reaches a capability-threshold model (FIN3b §7.2). Undefined
 *  when no vote is needed. The trust's no keeps such models out (a voluntary deal cannot sign with IP access; a
 *  rescue's licence stops below the thresholds). */
export function ipVote(s: GameStateV2, partner: string): BoardVote | undefined {
  const lab = affiliatedLab(s, partner);
  return lab ? ipTransferVote(s, `${lab.core.name}, ${partner}'s lab`) : undefined;
}

/** Why `partner` will not sign a deal (with `supply`) now, or undefined if it will. Shown on its offer. */
export function partnerBlocker(s: GameStateV2, partner: string, supply?: PartnerSupply): string | undefined {
  const p = partnerDef(partner);
  if (!p) return `${partner} is not a partner`;
  const div = divisionBlock(s);
  if (div) return div;
  const f = s.player.finance;
  if (f.state === 'insolvent') return 'Insolvent';
  if (f.state === 'distress') return 'Distress: only a rescue is on offer';
  const v = vetoesOf(s, partner);
  if (v.length) return `${v[0]}'s exclusivity blocks deals with ${partner}`;
  if (dealWith(s, partner)) return `Already your partner (one deal per partner)`;
  const now = partnersNow(s);
  if (now.length >= ST.maxPartners) return `You have ${now.length} partners, the most at once (${now.join(', ')})`;
  if (supply && !p.supply.includes(supply)) return `${partner} does not offer ${SUPPLY_LABEL[supply]}`;
  if (p.kind === 'hyperscaler' && hyperscalerRoom(s, partner) <= 0) {
    return `${partner} holds ${Math.round(stakeOf(s, partner) * 100)}%: a hyperscaler's stake is capped at ${Math.round(PARTNER_TERMS.hyperscaler.stakeCap * 100)}%`;
  }
  return undefined;
}

/** A hyperscaler's cloud commitment of `C` dollars over `years` years, booked one firm contract a year (FIN4a, C7a): year
 *  y pays C / years, sized at that year's expected cloud price less the firm discount (of the whole term) and the partner's,
 *  so the capacity each year buys grows as prices fall. `h100e` is the first year's. */
function cloudSupply(s: GameStateV2, C: number, years: number, partnerDiscount: number): NonNullable<PartnerTerms['supply']> {
  const termQ = years * 4;
  const yearly: number[] = [];
  const perQ: number[] = [];
  const prices: number[] = [];
  for (let y = 0; y < years; y++) {
    const at = { startQ: 1 + 4 * y, termQ };
    const h = C / years / rentQuote(s, 1, 4, true, partnerDiscount, at).total;
    const q = rentQuote(s, h, 4, true, partnerDiscount, at);
    yearly.push(h);
    perQ.push(...q.perQ);
    prices.push(...q.perH);
  }
  return { kind: 'cloud', h100e: yearly[0], yearly, quarters: termQ, first: prices[0], last: prices[termQ - 1], firmDiscount: firmDiscount(termQ), partnerDiscount, total: perQ.reduce((a, b) => a + b, 0), perQ, prices, startQ: qOf(s) + 1 };
}

/** Chips every quarter on the expected list path less the firm discount, × `priceMult` (`chipQuote`, as Buy chips). */
function chipSupply(s: GameStateV2, kind: 'asic' | 'chips', perQ: number, quarters: number, opts: { partnerDiscount?: number; costMult?: number }): NonNullable<PartnerTerms['supply']> {
  const mult = (opts.costMult ?? 1) * (1 - (opts.partnerDiscount ?? 0));
  const q = chipQuote(s, quarters, perQ, { priceMult: mult });
  const prices = q.prices ?? [q.price];
  return {
    kind, h100e: perQ, quarters: q.quarters, first: prices[0], last: prices[prices.length - 1], firmDiscount: q.discount, partnerDiscount: opts.partnerDiscount ?? 0,
    ...(opts.costMult !== undefined ? { costMult: opts.costMult } : {}), total: q.total, perQ: prices.map((p, k) => (perQ * p) / 1e6 - (k === 0 ? q.now : 0)), prices, startQ: q.dueQ,
    ...(q.now > 0 ? { prepaid: q.now } : {}),
  };
}

/** Custom chips for the commitment `C` ($B): the same dollars as the cloud option, at `costMult` of the H100e list path
 *  over `asic.quarters`, so the quantity each quarter is what C buys. */
function asicSupply(s: GameStateV2, C: number): NonNullable<PartnerTerms['supply']> {
  const a = PARTNER_TERMS.asic;
  const unit = chipQuote(s, a.quarters, 1, { priceMult: a.costMult });
  const perQ = (C * 1e6) / (unit.prices ?? [unit.price]).reduce((x, y) => x + y, 0);
  return chipSupply(s, 'asic', perQ, a.quarters, { costMult: a.costMult });
}

/** Quarters from now to the end of the quarter in which the supply's payments (the prepaid part at signing, then each
 *  quarter's) add up to `amount` ($B). A 'spent:' tranche lapses PARTNER_TERMS slackQ quarters after that. */
function paidByQ(s: GameStateV2, sp: NonNullable<PartnerTerms['supply']>, amount: number): number {
  let cum = sp.prepaid ?? 0;
  if (cum >= amount - 1e-9) return 0;
  for (let k = 0; k < sp.perQ.length; k++) {
    cum += sp.perQ[k];
    if (cum >= amount - 1e-9) return sp.startQ - qOf(s) + k + 1;
  }
  return sp.startQ - qOf(s) + sp.perQ.length;
}
/** A 'spent:' tranche condition: `amount` ($B, rounded down to the cent) paid to `partner` since signing. */
const spentCond = (partner: string, amount: number) => `spent:${partner}:${(Math.floor(amount * 100) / 100).toFixed(2)}`;

/** The supply options a partner offers (a hyperscaler: cloud, and custom chips for Azimuth; a chip vendor: its chips). */
export const supplyOptions = (partner: string): PartnerSupply[] => partnerDef(partner)?.supply ?? [];

/** What a partner offer is chosen with (FIN4b): the supply, and the optional strings (both off by default). */
export interface PartnerChoice { supply?: PartnerSupply; exclusive?: boolean; ipAccess?: boolean }

/** The terms `partner` offers now (spec §6.1; sizes in data/v2/deals.ts PARTNER_TERMS), with the optional strings chosen
 *  in `opts` (FIN4b): exclusivity adds 25% to the money, IP access up to 20% (by your lead over its lab), both under the
 *  15% stake cap; `options` says what each adds or why it is not on offer. The commitment is in dollars: 4 × a
 *  hyperscaler's total equity, the dollar value of 2 GW of a vendor's chips; tranches land as it is paid. A rescue
 *  (spec §6.2) is cash for shares at half the valuation, a two-vote board seat, exclusivity and IP access (when the
 *  partner has a lab). */
export function partnerTerms(s: GameStateV2, partner: string, opts: PartnerChoice & { rescue?: boolean } = {}): PartnerTerms {
  const p = partnerDef(partner);
  const V = V0(s);
  const q = qOf(s);
  const at = (k: number): Day => dayOfQuarter(s.time.startDate, q + k);
  const exBlock = exclusiveBlocker(s, partner);
  const ipBlock = ipBlocker(s, partner);
  const lab = affiliatedLab(s, partner);
  const ex = !exBlock && !!opts.exclusive;
  const ip = !ipBlock && !!opts.ipAccess;
  const ipLab = lab ? { lab: lab.core.id, labName: lab.core.name } : {};
  const off = (blocked?: string): PartnerOption => ({ on: false, bump: 0, ...(blocked ? { blocked } : {}) });
  const base = { partner, kind: p?.kind ?? ('chipVendor' as const), rescue: false, equityNow: 0, tranches: [] as PartnerTerms['tranches'], strings: {}, years: 0, options: { exclusive: off(exBlock), ipAccess: { ...off(ipBlock), ...ipLab } } };
  if (!p) return base;
  if (opts.rescue) {
    const t = PARTNER_TERMS.rescue;
    const burn = Math.max(0, runwayOf(s).burnQ);
    // IP access is part of a rescue when the partner has a lab; under PBC + trust a licence of a capability-threshold
    // model needs the trust, and its no keeps such models out of the licence (the rescue still goes ahead).
    const v = ipVote(s, partner);
    const ipStr = lab ? { ipAccess: { lab: lab.core.id, ...(v?.passes ? { trust: true } : {}) } } : {};
    return {
      ...base, rescue: true, equityNow: Math.min(t.maxShareOfV * V, Math.max(t.minCash, 2 * burn)), priceMult: t.priceMult, strings: { exclusivity: true, boardVotes: t.seats, ...ipStr }, years: t.years,
      options: { exclusive: { on: true, bump: 0 }, ipAccess: { on: !!lab, bump: 0, ...ipLab, ...(lab ? {} : { blocked: ipBlock ?? 'No lab to license to' }) } },
    };
  }
  const strings = (extra: PartnerTerms['strings'] = {}): PartnerTerms['strings'] => ({ ...(ex ? { exclusivity: true } : {}), ...extra, ...(ip && lab ? { ipAccess: { lab: lab.core.id, ...(ipVote(s, partner)?.passes ? { trust: true } : {}) } } : {}) });
  if (p.kind === 'hyperscaler') {
    const t = PARTNER_TERMS.hyperscaler;
    const per = Math.min(t.trancheMax, t.equityShareOfV * V);
    const room = hyperscalerRoom(s, partner);
    const ipScale = lab ? ipLeadScale(s, lab.core.id) : 0;
    // All the equity (now + two tranches) at a multiple of the plain offer, under the 15% cap; each string's bump is the
    // difference it makes with the other string as chosen. IP access's money scales with your lead over its lab.
    const total = (e: boolean, i: boolean) => Math.max(0, Math.min(per * t.tranches * (1 + (e ? ST.exclusiveBump : 0) + (i ? ST.ipBump * ipScale : 0)), room));
    const E = total(ex, ip) / t.tranches;
    // The commitment, in dollars: 4 × all the equity, whichever supply it buys.
    const C = t.commitMult * total(ex, ip);
    const want = opts.supply && p.supply.includes(opts.supply) ? opts.supply : p.supply[0];
    const supply = want === 'asic' ? asicSupply(s, C) : cloudSupply(s, C, t.years, t.discount);
    return {
      ...base, equityNow: E,
      tranches: t.spentAt.map((f, i) => ({ amount: E, condition: spentCond(partner, C * f), dueDay: at(2 + 2 * i), deadline: at(paidByQ(s, supply, C * f) + t.slackQ) })),
      supply, strings: strings({ distribution: { ...t.distribution } }), stakeCap: t.stakeCap, years: t.years,
      options: {
        exclusive: { ...off(exBlock), on: ex, bump: exBlock ? 0 : total(true, ip) - total(false, ip) },
        ipAccess: { ...off(ipBlock), ...ipLab, on: ip, bump: ipBlock ? 0 : total(ex, true) - total(ex, false) },
      },
    };
  }
  if (p.kind === 'chipVendor') {
    const t = PARTNER_TERMS.chipVendor;
    const supply = chipSupply(s, 'chips', (t.gw * 1e6) / s.power.kWPerH100e / t.quarters, t.quarters, { partnerDiscount: t.discount });
    const perGW = t.perGW * (ex ? 1 + ST.exclusiveBump : 1);
    // One tranche per GW-worth of its chips paid: the commitment (the dollar value of its GW at the path) in equal parts.
    const tranches = Array.from({ length: t.gw }, (_, i) => {
      const paid = (supply.total * (i + 1)) / t.gw;
      return { amount: perGW, condition: spentCond(partner, paid), dueDay: at(1), deadline: at(paidByQ(s, supply, paid) + t.slackQ) };
    });
    return { ...base, tranches, supply, strings: strings(), years: (supply.startQ - q + supply.quarters) / 4, options: { ...base.options, exclusive: { ...off(exBlock), on: ex, bump: exBlock ? 0 : t.gw * t.perGW * ST.exclusiveBump } } };
  }
  return base;
}
/** Take-or-pay payments due in the first four quarters of a deal's supply, with any part of the first delivery prepaid at
 *  signing (FIN5a) ($B): the board's commitments test (§7.3). */
export const firstYearCommit = (t: PartnerTerms) => (t.supply?.prepaid ?? 0) + (t.supply?.perQ ?? []).slice(0, 4).reduce((a, b) => a + b, 0);

/** Every equity tranche and the cash in now ($B). */
export const termsEquity = (t: PartnerTerms) => t.equityNow + t.tranches.reduce((a, x) => a + x.amount, 0);

/** The partner's share of the equity right after signing these terms (the equity now; a rescue at its distress price), on a
 *  copy of the cap table. Later tranches are not counted (they may never land): see `partnerStakeAll`. */
export function partnerStakeAfter(s: GameStateV2, t: Pick<PartnerTerms, 'partner' | 'equityNow' | 'priceMult'>): number {
  const o = JSON.parse(JSON.stringify(s.player.finance.ownership)) as GameStateV2['player']['finance']['ownership'];
  const V = V0(s) * (t.priceMult ?? 1);
  if (t.equityNow > 0) issue(o, t.equityNow / (V + t.equityNow), { kind: 'strat', name: t.partner });
  return o.strat[t.partner] ?? 0;
}

/** The most the partner would hold if every tranche landed (at the valuation each lands at: the money added to it), under
 *  a hyperscaler's stake cap. */
export function partnerStakeAll(s: GameStateV2, t: PartnerTerms): number {
  const V = V0(s);
  const eq = termsEquity(t);
  const all = (stakeOf(s, t.partner) * V + eq) / (V + eq);
  return t.stakeCap !== undefined ? Math.min(all, Math.max(t.stakeCap, partnerStakeAfter(s, t))) : all;
}

/** The votes a deal needs, in the order they are held: the trust's (PBC + trust, §7.2: a sale of control, a holder past
 *  50%; IP access that would license a capability-threshold model, FIN4b), then the board's (§7.3: a sale of control;
 *  a rescue, or firm commitments above 3× revenue). A rescue's IP access is not voted: the trust's no only keeps
 *  threshold models out of its licence (`partnerTerms`). */
export function dealVotes(s: GameStateV2, t: PartnerTerms): BoardVote[] {
  // The trust's votes first: they cannot be forced, so a founder never pays the force cost for a deal the trust stops.
  const control = controlVotes(s, t.partner, partnerStakeAfter(s, t));
  const ip = t.strings.ipAccess && !t.rescue ? ipVote(s, t.partner) : undefined;
  const own = t.rescue ? boardVote(s, 'rescue', `${t.partner} takes a ${Math.round(partnerStakeAfter(s, t) * 100)}% stake at half the valuation, a board seat with ${t.strings.boardVotes ?? 0} votes, exclusivity${t.strings.ipAccess ? ' and IP access' : ''}`) : commitmentsVote(s, firstYearCommit(t));
  return [...control.filter((v) => v.body === 'trust'), ip, ...control.filter((v) => v.body !== 'trust'), own].filter((v): v is BoardVote => !!v);
}
/** The vote to show for a deal: the first failing one, else the first needed. */
export const dealVote = (vs: BoardVote[]) => vs.find((v) => !v.passes) ?? vs[0];

/** Who would rescue the company now: among the hyperscalers that no other partner's running exclusivity blocks, the one
 *  that already holds the largest stake (the most to lose; ties go to the order of PARTNER_DEFS). */
export function rescuePartner(s: GameStateV2): string | undefined {
  let best: string | undefined;
  for (const x of PARTNER_DEFS) {
    if (x.kind !== 'hyperscaler' || vetoesOf(s, x.id).length) continue;
    if (best === undefined || stakeOf(s, x.id) > stakeOf(s, best)) best = x.id;
  }
  return best;
}

/** Sign `partner`'s deal on today's terms (shown before signing by `partnerTerms`): equity now, tranches with their
 *  conditions, the supply against its take-or-pay commitment, the strings. The votes come first, before any side
 *  effect. Returns why it did not go through, or undefined. */
export function signPartner(s: GameStateV2, ctx: SystemCtx, partner: string, opts: PartnerChoice & { rescue?: boolean; force?: boolean } = {}): string | undefined {
  ensureWs3(s);
  const f = s.player.finance;
  if (!opts.rescue) {
    const why = partnerBlocker(s, partner, opts.supply);
    if (why) return why;
  }
  const t = partnerTerms(s, partner, opts);
  const paid0 = paidTo(s, partner); // what the partner had been paid at signing: its 'spent:' tranches count from here
  for (const v of dealVotes(s, t)) {
    const no = voteGate(ctx, v, !!opts.force);
    if (no) return no;
  }
  const q = qOf(s);
  const label = t.rescue ? 'strategic rescue' : `${t.kind === 'hyperscaler' ? 'hyperscaler' : 'chip-vendor'} equity`;
  partnerEquityIn(s, ctx, partner, t.equityNow, label, undefined, t.priceMult);
  if (t.rescue) {
    f.stratVoting = { ...(f.stratVoting ?? {}), [partner]: true }; // the rescuer's stake votes (control.ts seats it)
    f.ws3.lastRescueDay = s.time.day;
  }
  t.tranches.forEach((x, i) => f.tranches.push({
    amount: x.amount, dueDay: x.dueDay, condition: x.condition, deadline: x.deadline,
    source: t.kind === 'chipVendor' ? `${partner} equity per GW` : `${partner} tranche ${i + 2}`, partner, spentBase: paid0, ...(t.stakeCap !== undefined ? { stakeCap: t.stakeCap } : {}),
  }));
  let supplyEnd = s.time.day;
  if (t.supply?.kind === 'cloud') {
    // One firm contract a year (the capacity grows as prices fall), each priced with the discount of the whole term.
    for (const [y, h] of (t.supply.yearly ?? [t.supply.h100e]).entries()) {
      const c = addCloud(s, ctx, h, 4, partner, { partnerDiscount: t.supply.partnerDiscount, startQ: 1 + 4 * y, termQ: t.supply.quarters });
      supplyEnd = Math.max(supplyEnd, c.endDay);
    }
  } else if (t.supply) {
    const o = placeOrder(s, ctx, t.supply.quarters, t.supply.h100e, { priceMult: (t.supply.costMult ?? 1) * (1 - t.supply.partnerDiscount), payee: partner });
    supplyEnd = dayOfQuarter(s.time.startDate, o.ltaEndQ ?? q + 2 + t.supply.quarters);
    if (t.supply.kind === 'asic') {
      // Separate supply pool (TPU/Trainium): served outside rationing; migration slows research ~2.5 quarters [R15].
      f.ws3.reserved.push({ perQ: t.supply.h100e, fromQ: t.supply.startQ, toQ: t.supply.startQ + t.supply.quarters, order: o.id }); // its own pool (FIN4r L9)
      f.ws3.asicMigrationUntil = s.time.day + PARTNER_TERMS.asic.migrationDays;
    }
  }
  const until = Math.max(supplyEnd, s.time.day + Math.round(t.years * 365));
  const deal: StrategicDeal = {
    id: `DL${s.time.day}-${f.deals.length}`, partner, kind: t.kind, day: s.time.day, equityNow: t.equityNow, equityLater: t.tranches.reduce((a, x) => a + x.amount, 0),
    ...(t.supply ? { supply: { kind: t.supply.kind, h100e: t.supply.h100e, ...(t.supply.yearly ? { yearly: t.supply.yearly } : {}), quarters: t.supply.quarters, first: t.supply.first, last: t.supply.last, firmDiscount: t.supply.firmDiscount, partnerDiscount: t.supply.partnerDiscount, ...(t.supply.costMult !== undefined ? { costMult: t.supply.costMult } : {}), total: t.supply.total, endDay: supplyEnd } } : {}),
    strings: { ...t.strings }, until, ...(t.rescue ? { rescue: true } : {}),
  };
  f.deals.push(deal);
  const ipWords = t.strings.ipAccess ? `, IP access for ${labName(s, t.strings.ipAccess.lab)}` : '';
  if (t.rescue) ctx.log('alert', `${partner} rescues the company: $${t.equityNow.toFixed(0)}B for ${Math.round(stakeOf(s, partner) * 100)}% held now, a board seat with ${t.strings.boardVotes} votes and exclusivity${ipWords}.`, 4);
  else ctx.log('finance', `Deal signed with ${partner}: $${t.equityNow.toFixed(1)}B now${deal.equityLater > 0 ? `, $${deal.equityLater.toFixed(1)}B in tranches` : ''}${t.supply ? `, ${SUPPLY_LABEL[t.supply.kind]} ($${t.supply.total.toFixed(1)}B take-or-pay)` : ''}${t.strings.exclusivity ? ', exclusive' : ''}${ipWords}.`);
  return undefined;
}

/** Every partner with its offer now (Finance Partners card, bots): the terms with the choices made so far, or why it
 *  will not deal. */
export function partnerOffers(s: GameStateV2, choice: Partial<Record<string, PartnerChoice>> = {}): { partner: string; kind: StrategicDeal['kind']; supply: PartnerSupply[]; blocked?: string; terms?: PartnerTerms }[] {
  return PARTNER_DEFS.map((p) => {
    const c = choice[p.id] ?? {};
    const blocked = partnerBlocker(s, p.id, c.supply);
    return { partner: p.id, kind: p.kind, supply: p.supply, ...(blocked ? { blocked } : { terms: partnerTerms(s, p.id, c) }) };
  });
}

/** What each of your partners costs you now (Partners card, FIN4b): C7c: what its distribution's fee and its share of
 *  all revenue (the legacy Northwind stake) cost now and over what is left of the deal at your growth, IP access (the lab and the days of lead it closes a year at your estimated lead), and the partners
 *  its exclusivity blocks. Take-or-pay payments live in Contracts. */
export function partnerCosts(s: GameStateV2): { partner: string; distribution?: CutProjection; share?: CutProjection; ip?: { lab: LabId; labName: string; daysYr: number; leadEst: number; noThreshold: boolean }; blocks: string[] }[] {
  const out: ReturnType<typeof partnerCosts> = [];
  for (const d of s.player.finance.deals) {
    const running = d.until > s.time.day;
    if (d.legacy && !(running && d.strings.revenueShare)) continue;
    const ip = running ? d.strings.ipAccess : undefined;
    const lead = ip ? leadEstimate(s, ip.lab) : 0;
    out.push({
      partner: d.partner,
      ...dealCutProjections(s, d),
      ...(ip ? { ip: { lab: ip.lab, labName: labName(s, ip.lab), daysYr: ST.ipCloseYr * Math.max(0, lead), leadEst: lead, noThreshold: missionPowers(s) && !ip.trust } } : {}),
      blocks: d.strings.exclusivity ? (partnerDef(d.partner)?.competitors ?? []) : [],
    });
  }
  return out;
}
