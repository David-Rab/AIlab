// Partner interest and dependence (C7b, design/corp/CORPORATE.md §5.1, §5.4; DEALS-AUDIT.md findings 11, 12). Owner: WS3.
//
//   interest   one number a partner has about you, around 1 (0.5–1.5), built from named parts shown to the player in
//              words. It sizes a plain offer's equity, picks the rescuer and gates follow-on offers.
//   dependence the partner's share of your compute capacity now: its cloud contracts plus the chips it delivered. A
//              renewal's partner discount is the base discount × (1 − dependence).
// A leaf of the deals layer: finance/deals.ts imports it, never the reverse.
import { partnerDef, type CompanyId } from '../../../data/v2/deals';
import { computeOnlineOf } from '../compute/power';
import type { GameStateV2, Money, RivalLab, StrategicDeal } from '../types';
import { directChannelRevenue, partnerRevenue } from './distribution';
import { qOf } from './ledger';
import { leadEstimate } from './observe';

/** Interest parts (CORPORATE.md §5.1), all [D]: the weight of each and the clamp. */
export const PARTNER_INTEREST = {
  /** + this × the share of your trailing 4-quarter compute payments that went to the partner. */
  spend: 0.3,
  /** + this × the share of your API and enterprise revenue that sells through the partner. */
  channel: 0.2,
  /** − this × (1 − your lead over its own lab in months ÷ `ownLabMonths`), clamped 0..1. */
  ownLab: 0.3,
  ownLabMonths: 6,
  /** − this when any rival lab has the partner as a backer. */
  backsRival: 0.2,
  /** − this when you have a running deal with one of its competitors. */
  competitor: 0.2,
  /** − this when you hold an Azimuth custom-chip supply (Silica only). */
  customChips: 0.2,
  /** The value stays between these. */
  min: 0.5,
  max: 1.5,
  /** A follow-on is offered at this interest or more, at most once per `followOnGapDays` per partner. */
  followOn: 1.2,
  followOnGapDays: 365,
} as const;

/** A deal signed in the game that has not reached its `until` (legacy stakes excluded): the partner's running deal. */
export const isRunningDeal = (s: GameStateV2, d: StrategicDeal) => !d.legacy && d.until > s.time.day;
export const runningDeal = (s: GameStateV2, partner: string): StrategicDeal | undefined => s.player.finance.deals.find((d) => d.partner === partner && isRunningDeal(s, d));

/** A partner's affiliated lab now (CORPORATE.md §5.8): the active NPC lab whose cast owner is that company, or none (a
 *  chip vendor owns no lab; when the player's kind replaced the partner's lab, the lab is the player's: none). */
export function affiliatedLab(s: GameStateV2, partner: string): RivalLab | undefined {
  return s.rivals.find((r) => r.core.status === 'active' && r.npc.owner === partner);
}

/** Record `paidTo` at the start of each quarter (called monthly; the last 5 are kept). */
export function snapshotPaid(s: GameStateV2): void {
  const w = s.player.finance.ws3;
  const q = qOf(s);
  const h = (w.paidSnap ??= []);
  if (h.length && h[h.length - 1].q === q) return;
  h.push({ q, paid: { ...(w.paidTo ?? {}) } });
  if (h.length > 5) h.shift();
}

const sum = (m: Record<string, Money>) => Object.values(m).reduce((a, b) => a + b, 0);

/** Your payments to `partner` in the trailing 4 quarters ($B) and to everyone ($B): the tally now less the oldest
 *  quarter-start snapshot (before there are 4 quarters of history, since the start). */
export function trailingPaid(s: GameStateV2, partner: string): { partner: Money; total: Money } {
  const w = s.player.finance.ws3;
  const now = w.paidTo ?? {};
  const old = w.paidSnap?.[0]?.paid ?? {};
  return { partner: Math.max(0, (now[partner] ?? 0) - (old[partner] ?? 0)), total: Math.max(0, sum(now) - sum(old)) };
}

/** The share of your compute payments the partner got in the trailing 4 quarters. */
export function spendShare(s: GameStateV2, partner: string): number {
  const t = trailingPaid(s, partner);
  return t.total > 1e-9 ? Math.min(1, t.partner / t.total) : 0;
}

/** The share of your API and enterprise revenue that sells through `partner`'s distribution (running deal only). */
export function channelShare(s: GameStateV2, partner: string): number {
  const d = runningDeal(s, partner);
  const mine = d?.strings.distribution?.reach ?? 0;
  if (mine <= 0) return 0;
  let reach = 0;
  for (const x of s.player.finance.deals) if (x.strings.distribution && isRunningDeal(s, x)) reach += x.strings.distribution.reach;
  const viaPartner = partnerRevenue(s) * (mine / Math.max(mine, reach));
  const all = directChannelRevenue(s) + partnerRevenue(s);
  return all > 1e-9 ? Math.min(1, viaPartner / all) : 0;
}

/** The rival labs the partner has money in (the cast's `backers`). */
export const backedRivals = (s: GameStateV2, partner: string): RivalLab[] =>
  s.rivals.filter((r) => r.core.status === 'active' && (r.npc.backers?.[partner as CompanyId] ?? 0) > 0);

/** Months of lead you have over `lab` (your estimate; 0 when level or behind). */
const leadMonthsOver = (s: GameStateV2, lab: RivalLab) => Math.max(0, leadEstimate(s, lab.core.id)) / 30.4;

export interface InterestPart { label: string; v: number }
export interface Interest { value: number; parts: InterestPart[] }

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** How much `partner` values you now: 1 plus the parts that apply, clamped to 0.5–1.5. The parts are in player words,
 *  e.g. "you spend 40% of your compute payments with it". */
export function partnerInterest(s: GameStateV2, partner: string): Interest {
  const K = PARTNER_INTEREST;
  const p = partnerDef(partner);
  const parts: InterestPart[] = [{ label: 'a partner to start with', v: 1 }];
  if (!p) return { value: 1, parts };
  const spend = spendShare(s, partner);
  if (spend > 0) parts.push({ label: `you spend ${pct(spend)} of your compute payments with it`, v: K.spend * spend });
  if (p.kind === 'hyperscaler') {
    const ch = channelShare(s, partner);
    if (ch > 0) parts.push({ label: `it sells ${pct(ch)} of your API and enterprise revenue`, v: K.channel * ch });
  }
  const lab = affiliatedLab(s, partner);
  if (lab) {
    const m = leadMonthsOver(s, lab);
    const near = Math.min(1, Math.max(0, 1 - m / K.ownLabMonths));
    if (near > 0) parts.push({ label: m > 0 ? `its own lab, ${lab.core.name}, is only ${m < 1 ? 'under a month' : `${Math.round(m)} months`} behind you` : `its own lab, ${lab.core.name}, is level with you or ahead`, v: -K.ownLab * near });
  }
  const backed = backedRivals(s, partner);
  if (backed.length) parts.push({ label: `its money is on ${backed.map((r) => r.core.name).join(', ')}, a rival of yours`, v: -K.backsRival });
  const rival = p.competitors.find((c) => runningDeal(s, c));
  if (rival) parts.push({ label: `you lean on ${rival}, its competitor`, v: -K.competitor });
  if (p.kind === 'chipVendor' && s.player.finance.deals.some((d) => isRunningDeal(s, d) && d.supply?.kind === 'asic')) {
    parts.push({ label: 'you buy custom chips instead of its own', v: -K.customChips });
  }
  const raw = parts.reduce((a, x) => a + x.v, 0);
  return { value: Math.min(K.max, Math.max(K.min, raw)), parts };
}

/** The interest in words for the offer card: "Azimuth values you highly: you spend 40% of ...; its own lab is ...". */
export function interestWords(s: GameStateV2, partner: string): string {
  const { value, parts } = partnerInterest(s, partner);
  const mood = value >= 1.2 ? 'values you highly' : value >= 0.9 ? 'values you about as most clients' : value >= 0.7 ? 'values you less than most' : 'barely needs you';
  const why = parts.slice(1).map((x) => x.label);
  return `${partner} ${mood}${why.length ? `: ${why.join('; ')}` : ''}`;
}

/** The partner's share of your compute capacity now (0–1): its cloud contracts live now (those ending within `grace`
 *  days still count, so a renewal sees the capacity that is ending) plus the chips it delivered under its deals (a
 *  chip order's quarters elapsed × H100e a quarter; custom chips by year). */
export function dependence(s: GameStateV2, partner: string, grace = 0): number {
  const day = s.time.day;
  let h = 0;
  for (const c of s.player.cloud) if (c.provider === partner && c.startDay <= day && c.endDay + grace > day) h += c.h100e;
  const q = qOf(s);
  for (const d of s.player.finance.deals) {
    const sp = d.supply;
    if (d.partner !== partner || !sp || sp.kind === 'cloud') continue;
    const sinceQ = Math.max(0, q - qOf(s, d.day) - 1); // first delivery two quarters after signing
    if (sp.yearly) sp.yearly.forEach((per, y) => { h += per * Math.min(4, Math.max(0, sinceQ - 4 * y)); });
    else h += sp.h100e * Math.min(sp.quarters, sinceQ);
  }
  const total = Math.max(computeOnlineOf(s), h);
  return total > 1 ? Math.min(1, h / total) : 0;
}
