// Distribution and the legacy revenue share (C7c, design/corp/CORPORATE.md §5.2; DEALS-AUDIT.md finding 1). Owner: WS3.
//
//   reach     X = Σ reach of the running deals with a distribution string (PARTNER_TERMS.hyperscaler.distribution)
//   channel   an API or enterprise product's customers ×(1 + X): the extra X is the partner's cloud customers, a copy
//             of the product's own need segments × X served after its own customers (worldfx/revenue.ts revenueReadout);
//             the revenue they bring is (revenue with X) − (revenue without), read off those segments in the same pass
//   cut       each deal's fee × its part (by reach) of that revenue, paid monthly with the payroll (cashflow.ts)
//   legacy    the legacy Northwind stake: a share of all revenue (LEGACY_NORTHWIND), to `until`
//   projection the rate now, grown at the trailing 4-quarter revenue growth (story.ts growthOf), capped at 2× a year
//             (DISTRIBUTION.growthCap), integrated over the deal: ∫₀ᵀ R·gᵗ dt
import { DISTRIBUTION } from '../../../data/v2/deals';
import type { Deployment, GameStateV2, Money, StrategicDeal } from '../types';
import { growthOf } from './story';

const running = (s: GameStateV2, d: StrategicDeal) => d.until > s.time.day;

/** Does product `d` sell through a partner's distribution (its channel is one the partner resells)? */
export const distributes = (d: Pick<Deployment, 'channel'>) => DISTRIBUTION.channels.includes(d.channel);

/** The extra reach the running distribution deals give the API and enterprise channels (0.25 = +25%). */
export function distributionReach(s: GameStateV2): number {
  let x = 0;
  for (const d of s.player.finance.deals) if (d.strings.distribution && running(s, d)) x += d.strings.distribution.reach;
  return x;
}

/** The partners' fee on the revenue their distribution brings, weighted by each running deal's reach (0 without one). */
export function distributionFee(s: GameStateV2): number {
  let x = 0;
  let f = 0;
  for (const d of s.player.finance.deals) {
    const t = d.strings.distribution;
    if (!t || !running(s, d)) continue;
    x += t.reach;
    f += t.reach * t.fee;
  }
  return x > 0 ? f / x : 0;
}

/** Revenue sold through partners now ($B/yr, as the revenue system last computed it). */
export function partnerRevenue(s: GameStateV2): Money {
  let x = 0;
  for (const d of s.player.deployments) x += d.partnerRate ?? 0;
  return x;
}

/** The partners' cut ($B/yr) of partner revenue `rev` (default: now). */
export const distributionCut = (s: GameStateV2, rev: Money = partnerRevenue(s)) => distributionFee(s) * rev;

/** API and enterprise revenue you sell yourself now ($B/yr: live products of those channels, partner sales excluded). */
export function directChannelRevenue(s: GameStateV2): Money {
  let x = 0;
  for (const d of s.player.deployments) if (d.status === 'live' && distributes(d)) x += (d.revenueRate ?? 0) - (d.partnerRate ?? 0);
  return Math.max(0, x);
}

/** Revenue growth a year the projections use: the trailing 4-quarter growth, at most DISTRIBUTION.growthCap. */
export function projectionGrowth(s: GameStateV2): number {
  const f = s.player.finance;
  return Math.min(DISTRIBUTION.growthCap, growthOf(f.revenueRun, f.revenueHistory));
}

/** A rate `R` ($B/yr) growing `g`× a year, summed over `T` years: ∫₀ᵀ R·gᵗ dt. */
export function overYears(R: Money, g: number, T: number): Money {
  if (!(T > 0) || !(R > 0)) return 0;
  const lg = Math.log(g);
  return Math.abs(lg) < 1e-9 ? R * T : (R * (g ** T - 1)) / lg;
}

export interface CutProjection {
  /** Revenue the string applies to now ($B/yr): the partner's channel revenue (distribution), all revenue (a share). */
  base: Money;
  /** The share of `base` the partner keeps. */
  rate: number;
  /** What it keeps over `years` at `growth` ($B). */
  over: Money;
  years: number;
  growth: number;
}

/** An offer's distribution: about reach × your API and enterprise revenue now, of which the partner keeps `fee`, over the
 *  deal at your current growth. */
export function distributionProjection(s: GameStateV2, dist: { reach: number; fee: number }, years: number): CutProjection {
  const g = projectionGrowth(s);
  const base = dist.reach * directChannelRevenue(s);
  return { base, rate: dist.fee, over: overYears(dist.fee * base, g, years), years, growth: g };
}

/** A share of all revenue (the legacy Northwind stake): `share` of the run-rate now, over `years` at your current growth. */
export function shareProjection(s: GameStateV2, share: number, years: number): CutProjection {
  const g = projectionGrowth(s);
  const base = s.player.finance.revenueRun;
  return { base, rate: share, over: overYears(share * base, g, years), years, growth: g };
}

/** A running deal's strings that cost a share of revenue, projected over what is left of it: its distribution (its part,
 *  by reach, of partner revenue now) and its share of all revenue. */
export function dealCutProjections(s: GameStateV2, d: StrategicDeal): { distribution?: CutProjection; share?: CutProjection } {
  if (!running(s, d)) return {};
  const years = (d.until - s.time.day) / 365;
  const out: ReturnType<typeof dealCutProjections> = {};
  const t = d.strings.distribution;
  if (t) {
    const X = distributionReach(s);
    const g = projectionGrowth(s);
    const base = X > 0 ? (partnerRevenue(s) * t.reach) / X : 0;
    out.distribution = { base, rate: t.fee, over: overYears(t.fee * base, g, years), years, growth: g };
  }
  if (d.strings.revenueShare) out.share = shareProjection(s, d.strings.revenueShare, years);
  return out;
}
