// Strategic partners (FINANCE-V3 §6.1–§6.3; FIN4a): one offer flow. Each partner's terms are computed live from the
// company and the market and shown in full before you sign (`partnerTerms`); signing books exactly those terms
// (`signPartner`). Three kinds: a hyperscaler (non-voting equity in tranches, capped at 15%, plus cloud or custom chips
// at a discount, served first, against a take-or-pay commitment), a chip vendor (equity per GW you deploy, rationing
// priority, you buy its chips), a sovereign (a passive cheque with a political cost). A rescue (distress only) is the
// same flow. Every supply price follows the expected market path (FIN1) less the firm discount and the partner's own.
// Owner: WS3.
import { PARTNER_DEFS, PARTNER_TERMS, partnerDef, type PartnerSupply } from '../../../data/v2/deals';
import { dayOfQuarter } from '../core/time';
import type { BoardVote, Day, GameStateV2, PartnerTerms, StrategicDeal, SystemCtx } from '../types';
import { addCloud, chipQuote, placeOrder, rentQuote } from '../compute/orders';
import { cloudPricePerYear } from '../compute/market';
import { addSeat, boardVote, commitmentsVote, voteGate } from './board';
import { controlVotes } from './charter';
import { issue, partnerEquityIn, stakeRoom } from './equity';
import { ensureWs3 } from './ext';
import { qOf } from './ledger';
import { divisionBlock } from './parent';
import { runwayOf } from './runway';

export const SUPPLY_LABEL: Record<PartnerSupply, string> = { cloud: 'cloud capacity', asic: 'custom chips', chips: 'its chips' };

/** Partners whose exclusivity blocks a deal with `partner` (exclusivity strings, kept as before FIN4a). */
export function vetoesOf(s: GameStateV2, partner: string): string[] {
  const out: string[] = [];
  for (const d of s.player.finance.deals) {
    if (!d.strings.exclusivity || d.partner === partner) continue;
    if (partnerDef(d.partner)?.competitors.includes(partner)) out.push(d.partner);
  }
  return out;
}

const stakeOf = (s: GameStateV2, partner: string) => s.player.finance.ownership.strat[partner] ?? 0;
const gwOnline = (s: GameStateV2) => (s.player.computeOnline * s.power.kWPerH100e) / 1e6;
const V0 = (s: GameStateV2) => Math.max(10, s.player.finance.valuation);

/** Equity a hyperscaler may still buy ($B at today's valuation): its stake, tranches included, stays at or under 15%
 *  of the company (non-voting, capped [R21 B2]). */
export const hyperscalerRoom = (s: GameStateV2, partner: string) => stakeRoom(V0(s), stakeOf(s, partner), PARTNER_TERMS.hyperscaler.stakeCap);

/** A partner's deal signed in the game (not a stake from before the start), if any: one deal per partner (FIN4a). */
export const dealWith = (s: GameStateV2, partner: string) => s.player.finance.deals.find((d) => d.partner === partner && !d.legacy);

/** Why `partner` will not sign a deal (with `supply`) now, or undefined if it will. Shown on its offer. */
export function partnerBlocker(s: GameStateV2, partner: string, supply?: PartnerSupply): string | undefined {
  const p = partnerDef(partner);
  if (!p) return `${partner} is not a partner`;
  const div = divisionBlock(s);
  if (div) return div;
  const f = s.player.finance;
  if (f.state === 'insolvent') return 'Insolvent';
  if (f.state === 'distress') return 'Distress: only a rescue is on offer';
  const anchor = s.capital.ws3?.anchors[partner];
  if (anchor && anchor !== 'player') return `${partner} already anchors another lab`;
  const v = vetoesOf(s, partner);
  if (v.length) return `${v[0]}'s exclusivity blocks deals with ${partner}`;
  if (dealWith(s, partner)) return `Already your partner (one deal per partner)`;
  if (supply && !p.supply.includes(supply)) return `${partner} does not offer ${SUPPLY_LABEL[supply]}`;
  if (p.kind === 'hyperscaler' && hyperscalerRoom(s, partner) < PARTNER_TERMS.hyperscaler.trancheMin) {
    return `${partner} holds ${Math.round(stakeOf(s, partner) * 100)}%: a hyperscaler's stake is capped at ${Math.round(PARTNER_TERMS.hyperscaler.stakeCap * 100)}%`;
  }
  return undefined;
}

/** Cloud capacity on the expected path less the firm discount and the partner's (`rentQuote`, as Rent compute). */
function cloudSupply(s: GameStateV2, h100e: number, quarters: number, partnerDiscount: number): NonNullable<PartnerTerms['supply']> {
  const q = rentQuote(s, h100e, quarters, true, partnerDiscount);
  return { kind: 'cloud', h100e, quarters, first: q.perH[0], last: q.perH[quarters - 1], firmDiscount: q.discount, partnerDiscount, total: q.total, perQ: q.perQ, prices: q.perH, startQ: qOf(s) + 1 };
}

/** Chips every quarter on the expected list path less the firm discount, × `priceMult` (`chipQuote`, as Buy chips). */
function chipSupply(s: GameStateV2, kind: 'asic' | 'chips', perQ: number, quarters: number, opts: { partnerDiscount?: number; costMult?: number }): NonNullable<PartnerTerms['supply']> {
  const mult = (opts.costMult ?? 1) * (1 - (opts.partnerDiscount ?? 0));
  const q = chipQuote(s, quarters, perQ, { priceMult: mult });
  const prices = q.prices ?? [q.price];
  return {
    kind, h100e: perQ, quarters: q.quarters, first: prices[0], last: prices[prices.length - 1], firmDiscount: q.discount, partnerDiscount: opts.partnerDiscount ?? 0,
    ...(opts.costMult !== undefined ? { costMult: opts.costMult } : {}), total: q.total, perQ: prices.map((p) => (perQ * p) / 1e6), prices, startQ: q.dueQ,
  };
}

/** The supply options a partner offers (a hyperscaler: cloud, and custom chips for Azimuth; a chip vendor: its chips). */
export const supplyOptions = (partner: string): PartnerSupply[] => partnerDef(partner)?.supply ?? [];

/** The terms `partner` offers now (spec §6.1; sizes in data/v2/deals.ts PARTNER_TERMS). A rescue (spec §6.2) is cash
 *  for a large stake, a two-vote board seat and exclusivity. */
export function partnerTerms(s: GameStateV2, partner: string, opts: { supply?: PartnerSupply; rescue?: boolean } = {}): PartnerTerms {
  const p = partnerDef(partner) ?? { id: partner, kind: 'sovereign' as const, competitors: [], supply: [] };
  const V = V0(s);
  const q = qOf(s);
  const at = (k: number): Day => dayOfQuarter(s.time.startDate, q + k);
  const gw = gwOnline(s);
  const base = { partner, kind: p.kind, rescue: false, equityNow: 0, tranches: [] as PartnerTerms['tranches'], strings: {}, years: 0 };
  if (opts.rescue) {
    const t = PARTNER_TERMS.rescue;
    const burn = Math.max(0, runwayOf(s).burnQ);
    return { ...base, rescue: true, equityNow: Math.min(t.maxShareOfV * V, Math.max(t.minCash, 2 * burn)), strings: { exclusivity: true, boardVotes: t.seats }, stake: t.stake };
  }
  if (p.kind === 'hyperscaler') {
    const t = PARTNER_TERMS.hyperscaler;
    const per = Math.max(t.trancheMin, Math.min(t.trancheMax, t.equityShareOfV * V));
    const E = Math.max(0, Math.min(per * t.tranches, hyperscalerRoom(s, partner))) / t.tranches;
    const want = opts.supply && p.supply.includes(opts.supply) ? opts.supply : p.supply[0];
    let supply: PartnerTerms['supply'];
    if (want === 'asic') {
      const a = PARTNER_TERMS.asic;
      supply = chipSupply(s, 'asic', (a.gw * 1e6) / s.power.kWPerH100e / a.quarters, a.quarters, { costMult: a.costMult });
    } else {
      // Capacity: what the commitment (4 × the equity over 6 years) buys at today's cloud price; it is then paid on the
      // expected path less both discounts, so the payments fall with the market.
      const h = ((t.commitMult * E * t.tranches) / t.years) * 1e6 / Math.max(0.1, cloudPricePerYear(s));
      supply = cloudSupply(s, h, t.years * 4, t.discount);
    }
    return {
      ...base, equityNow: E,
      tranches: [
        { amount: E, condition: `gw:${(gw + 0.5).toFixed(1)}`, dueDay: at(2), deadline: at(8) },
        { amount: E, condition: `gw:${(gw + 1.5).toFixed(1)}`, dueDay: at(4), deadline: at(10) },
      ],
      supply, strings: { exclusivity: true, revenueShare: t.revenueShare }, stakeCap: t.stakeCap, years: t.years,
    };
  }
  if (p.kind === 'chipVendor') {
    const t = PARTNER_TERMS.chipVendor;
    const supply = chipSupply(s, 'chips', (t.gw * 1e6) / s.power.kWPerH100e / t.quarters, t.quarters, { partnerDiscount: t.discount });
    const tranches = Array.from({ length: t.gw }, (_, i) => ({ amount: t.perGW, condition: `gw:${(gw + i + 1).toFixed(1)}`, dueDay: at(1), deadline: at(t.deadlineQ) }));
    return { ...base, tranches, supply, years: (supply.startQ - q + supply.quarters) / 4 };
  }
  const t = PARTNER_TERMS.sovereign;
  return { ...base, equityNow: Math.max(t.min, Math.min(t.max, t.equityShareOfV * V)), politics: { scrutiny: t.scrutiny, congress: t.congress, securityDemand: t.securityDemand } };
}

/** Take-or-pay payments due in the first four quarters of a deal's supply ($B): the board's commitments test (§7.3). */
export const firstYearCommit = (t: PartnerTerms) => (t.supply?.perQ ?? []).slice(0, 4).reduce((a, b) => a + b, 0);

/** Every equity tranche and the cash in now ($B). */
export const termsEquity = (t: PartnerTerms) => t.equityNow + t.tranches.reduce((a, x) => a + x.amount, 0);

/** New shares (a fraction of the company) that take a holder from `stake` to `target`: issuing f dilutes it too, so
 *  stake·(1 − f) + f = target. */
const topUp = (stake: number, target: number) => Math.max(0, (target - stake) / (1 - stake));

/** The partner's share of the equity right after signing these terms (the equity now and, for a rescue, the top-up to
 *  its stake), on a copy of the cap table. Later tranches are not counted (they may never land). */
export function partnerStakeAfter(s: GameStateV2, t: Pick<PartnerTerms, 'partner' | 'equityNow' | 'rescue' | 'stake'>): number {
  const o = JSON.parse(JSON.stringify(s.player.finance.ownership)) as GameStateV2['player']['finance']['ownership'];
  const V = V0(s);
  if (t.equityNow > 0) issue(o, t.equityNow / (V + t.equityNow), { kind: 'strat', name: t.partner });
  if (t.rescue) issue(o, topUp(o.strat[t.partner] ?? 0, t.stake ?? PARTNER_TERMS.rescue.stake), { kind: 'strat', name: t.partner });
  return o.strat[t.partner] ?? 0;
}

/** The votes a deal needs, in the order they are held: a sale of control (a holder past 50%: under PBC + trust the
 *  trust's, §7.2, then the board's, §7.3); then the board on a rescue (§7.3) or on firm commitments above 3× revenue. */
export function dealVotes(s: GameStateV2, t: PartnerTerms): BoardVote[] {
  // The trust's vote first: it cannot be forced, so a founder never pays the force cost for a deal the trust stops.
  const control = controlVotes(s, t.partner, partnerStakeAfter(s, t));
  const own = t.rescue ? boardVote(s, 'rescue', `${t.partner} takes a ${Math.round((t.stake ?? 0) * 100)}% stake, a board seat with ${t.strings.boardVotes ?? 0} votes and exclusivity`) : commitmentsVote(s, firstYearCommit(t));
  return [...control, own].filter((v): v is BoardVote => !!v);
}
/** The vote to show for a deal: the first failing one, else the first needed. */
export const dealVote = (vs: BoardVote[]) => vs.find((v) => !v.passes) ?? vs[0];

/** Who would rescue the company now: the first hyperscaler or sovereign that is not blocked by another partner's
 *  exclusivity and anchors no other lab (spec §6.2, kept). */
export function rescuePartner(s: GameStateV2): string | undefined {
  return PARTNER_DEFS.find((x) => (x.kind === 'hyperscaler' || x.kind === 'sovereign') && !vetoesOf(s, x.id).length && (!s.capital.ws3?.anchors[x.id] || s.capital.ws3.anchors[x.id] === 'player'))?.id;
}

/** Sign `partner`'s deal on today's terms (shown before signing by `partnerTerms`): equity now, tranches with their
 *  conditions, the supply against its take-or-pay commitment, the strings. The votes come first, before any side
 *  effect. Returns why it did not go through, or undefined. */
export function signPartner(s: GameStateV2, ctx: SystemCtx, partner: string, opts: { supply?: PartnerSupply; rescue?: boolean; force?: boolean } = {}): string | undefined {
  ensureWs3(s);
  const f = s.player.finance;
  if (!opts.rescue) {
    const why = partnerBlocker(s, partner, opts.supply);
    if (why) return why;
  }
  const t = partnerTerms(s, partner, opts);
  for (const v of dealVotes(s, t)) {
    const no = voteGate(ctx, v, !!opts.force);
    if (no) return no;
  }
  const q = qOf(s);
  const label = t.rescue ? 'strategic rescue' : `${t.kind === 'hyperscaler' ? 'hyperscaler' : t.kind === 'chipVendor' ? 'chip-vendor' : 'sovereign'} equity`;
  partnerEquityIn(s, ctx, partner, t.equityNow, label);
  if (t.rescue) {
    issue(f.ownership, topUp(stakeOf(s, partner), t.stake ?? 0), { kind: 'strat', name: partner });
    addSeat(s, 'strategic', partner, t.strings.boardVotes ?? 0);
    f.ws3.lastRescueDay = s.time.day;
  }
  t.tranches.forEach((x, i) => f.tranches.push({
    amount: x.amount, dueDay: x.dueDay, condition: x.condition, deadline: x.deadline,
    source: t.kind === 'chipVendor' ? `${partner} equity per GW` : `${partner} tranche ${i + 2}`, partner, ...(t.stakeCap !== undefined ? { stakeCap: t.stakeCap } : {}),
  }));
  let ref: string | undefined;
  let supplyEnd = s.time.day;
  if (t.supply?.kind === 'cloud') {
    const c = addCloud(s, ctx, t.supply.h100e, t.supply.quarters, partner, { partnerDiscount: t.supply.partnerDiscount });
    ref = c.id;
    supplyEnd = c.endDay;
  } else if (t.supply) {
    const o = placeOrder(s, ctx, t.supply.quarters, t.supply.h100e, { priceMult: (t.supply.costMult ?? 1) * (1 - t.supply.partnerDiscount), payee: partner });
    ref = o.id;
    supplyEnd = dayOfQuarter(s.time.startDate, o.ltaEndQ ?? q + 2 + t.supply.quarters);
    if (t.supply.kind === 'asic') {
      // Separate supply pool (TPU/Trainium): served outside rationing; migration slows research ~2.5 quarters [R15].
      f.ws3.reserved.push({ perQ: t.supply.h100e, fromQ: t.supply.startQ, toQ: t.supply.startQ + t.supply.quarters });
      f.ws3.asicMigrationUntil = s.time.day + PARTNER_TERMS.asic.migrationDays;
    }
  }
  if (t.politics) {
    ctx.bump('relations.scrutiny', t.politics.scrutiny, `${partner} cheque`);
    ctx.bump('trust:congress', t.politics.congress, `${partner} cheque`);
    ctx.bump('gov.securityDemand', t.politics.securityDemand, `${partner} cheque`);
  }
  s.capital.ws3.anchors[partner] = 'player';
  const until = Math.max(supplyEnd, s.time.day + Math.round(t.years * 365));
  const deal: StrategicDeal = {
    id: `DL${s.time.day}-${f.deals.length}`, partner, kind: t.kind, day: s.time.day, equityNow: t.equityNow, equityLater: t.tranches.reduce((a, x) => a + x.amount, 0),
    ...(t.supply ? { supply: { kind: t.supply.kind, h100e: t.supply.h100e, quarters: t.supply.quarters, first: t.supply.first, last: t.supply.last, firmDiscount: t.supply.firmDiscount, partnerDiscount: t.supply.partnerDiscount, ...(t.supply.costMult !== undefined ? { costMult: t.supply.costMult } : {}), total: t.supply.total, endDay: supplyEnd, ...(ref ? { ref } : {}) } } : {}),
    strings: { ...t.strings }, until, ...(t.rescue ? { rescue: true } : {}),
  };
  f.deals.push(deal);
  if (t.rescue) ctx.log('alert', `${partner} rescues the company: $${t.equityNow.toFixed(0)}B for ${Math.round((t.stake ?? 0) * 100)}%, a board seat with ${t.strings.boardVotes} votes and exclusivity.`, 4);
  else ctx.log('finance', `Deal signed with ${partner}: $${t.equityNow.toFixed(1)}B now${deal.equityLater > 0 ? `, $${deal.equityLater.toFixed(1)}B in tranches` : ''}${t.supply ? `, ${SUPPLY_LABEL[t.supply.kind]} ($${t.supply.total.toFixed(1)}B take-or-pay)` : ''}.`);
  return undefined;
}

/** Every partner with its offer now (Finance Partners card, bots): the terms, or why it will not deal. */
export function partnerOffers(s: GameStateV2, supply: Partial<Record<string, PartnerSupply>> = {}): { partner: string; kind: StrategicDeal['kind']; supply: PartnerSupply[]; blocked?: string; terms?: PartnerTerms }[] {
  return PARTNER_DEFS.map((p) => {
    const want = supply[p.id];
    const blocked = partnerBlocker(s, p.id, want);
    return { partner: p.id, kind: p.kind, supply: p.supply, ...(blocked ? { blocked } : { terms: partnerTerms(s, p.id, want ? { supply: want } : {}) }) };
  });
}

/** Partners that could anchor a round now (Raise card): no other lab, no exclusivity against them (kept). */
export function anchorPartners(s: GameStateV2): string[] {
  return PARTNER_DEFS.filter((p) => !vetoesOf(s, p.id).length && (!s.capital.ws3?.anchors[p.id] || s.capital.ws3.anchors[p.id] === 'player')).map((p) => p.id);
}

