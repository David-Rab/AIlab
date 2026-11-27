// Paying for capex: cash, a financing lease, or (chips) a chip-backed loan (FINANCE-V3 §4). Owner: WS3.
//
// A lease changes timing, not cost: the lessor pays the capex and recovers it with its return, priced by your rating,
// as funded × CRF(r, n) a year for n years. It adds a long fixed obligation (in the rating's commitments term) and a
// residual-value guarantee: 50% of the unamortised balance if you walk away, a contingent liability.
import { BUILD_Q, CAPEX_LEASE, CHIP_LOAN_SPREAD_BP, DEBT_SIZING, DEBT_TERMS } from '../../../data/v2/deals';
import type { Commitment$, Day, GameStateV2, Money, Site } from '../types';

/** Capital-recovery factor: the annual payment that repays 1 over `years` at rate `r`. */
export const crf = (r: number, years: number) => (r <= 0 ? 1 / years : (r * Math.pow(1 + r, years)) / (Math.pow(1 + r, years) - 1));

/** The partner that guarantees your leases below rating B (FIN4b, spec §4): a running hyperscaler or chip-vendor deal
 *  (the first signed), or undefined. Only read when the rating is below B. */
export function leaseGuarantor(s: GameStateV2): string | undefined {
  if (CAPEX_LEASE.rate[s.player.finance.rating] !== undefined) return undefined;
  return s.player.finance.deals.find((d) => !d.legacy && (d.kind === 'hyperscaler' || d.kind === 'chipVendor') && d.until > s.time.day)?.partner;
}

/** Lessor's annual return at today's rating, or undefined when no lessor will fund you (below B without a partner's
 *  guarantee). FIN4b: a running hyperscaler or chip-vendor partner's guarantee opens leases below B at the B rate plus
 *  a premium (3 points [D]). */
export function leaseRate(s: GameStateV2): number | undefined {
  const r = CAPEX_LEASE.rate[s.player.finance.rating];
  if (r !== undefined) return r;
  return leaseGuarantor(s) ? (CAPEX_LEASE.rate.B ?? 0.12) + CAPEX_LEASE.guaranteePremium : undefined;
}
export const leaseAvailable = (s: GameStateV2): true | string => (leaseRate(s) !== undefined ? true : `No lessor funds you at rating ${s.player.finance.rating} (needs B or better, or a hyperscaler or chip-vendor partner's guarantee)`);

/** Remaining (unamortised) balance of a financing lease on `day`: the present value of the payments left at its rate. */
export function leaseBalance(c: Commitment$, day: Day): Money {
  if (c.kind !== 'finLease' || c.endDay <= day) return 0;
  const r = c.rate ?? 0.09;
  const start = Math.max(day, c.startDay ?? day);
  const yearsLeft = (c.endDay - start) / 365;
  const annual = c.perQuarter * 4;
  const pv = r > 0 ? (annual * (1 - Math.pow(1 + r, -yearsLeft))) / r : annual * yearsLeft;
  return pv / Math.pow(1 + r, Math.max(0, (start - day) / 365));
}

/** What a leased site's lessor has funded in buildings whose lease has not started (all of it before the first goes live). */
export const unbookedFunded = (x: Site): Money => (x.ws3.lease ? x.ws3.lease.byBuilding.slice(x.ws3.lease.booked).reduce((a, b) => a + b, 0) : 0);

/** Residual-value guarantees: 50% of each financing lease's unamortised balance [D], plus the same on the funded part of
 *  leased buildings still being built. Contingent: owed only if you walk away. */
export function contingentLiabilities(s: GameStateV2): { total: Money; items: { name: string; amount: Money }[] } {
  // A lease is one ledger entry, or several after a renegotiation split it (FIN4r): grouped by contract.
  const by = new Map<string, Money>();
  for (const c of s.player.finance.ledger) {
    if (c.kind !== 'finLease' || c.endDay <= s.time.day) continue;
    const key = c.contract ?? c.id;
    by.set(key, (by.get(key) ?? 0) + CAPEX_LEASE.rvgShare * leaseBalance(c, s.time.day));
  }
  for (const x of s.player.sites) if (x.stage !== 'blocked' && unbookedFunded(x) > 0) by.set(siteLeaseId(x.id), (by.get(siteLeaseId(x.id)) ?? 0) + CAPEX_LEASE.rvgShare * unbookedFunded(x));
  const items: { name: string; amount: Money }[] = [...by.entries()].map(([key, amount]) => {
    const site = s.player.sites.find((x) => siteLeaseId(x.id) === key);
    return { name: site ? site.name : `Chip lease ${key.replace(/^L-fin-/, '').replace(/-\d+$/, '')}`, amount };
  });
  return { total: items.reduce((a, i) => a + i.amount, 0), items };
}

/** Residual-value guarantee of one site's lease (buildings live: from their ledger entries; the rest: on the amount funded so far). */
export function siteRVG(s: GameStateV2, siteId: string): Money {
  const x = s.player.sites.find((y) => y.id === siteId);
  if (!x?.ws3.lease) return 0;
  const cs = s.player.finance.ledger.filter((l) => (l.contract ?? l.id) === siteLeaseId(siteId) && l.endDay > s.time.day);
  return CAPEX_LEASE.rvgShare * (cs.reduce((a, c) => a + leaseBalance(c, s.time.day), 0) + unbookedFunded(x));
}
export const siteLeaseId = (siteId: string) => `L-fin-${siteId}`;

/** `guarantor`: the partner guaranteeing a lease below rating B (FIN4b). */
export interface PayOption { id: 'cash' | 'lease' | 'loan'; label: string; total: Money; now: Money; perYear: Money; years: number; rate?: number; blocked?: string; note: string; guarantor?: string }

/** A site's expected construction schedule (compute/sites.ts `siteSchedule`): quarters to go-live (the first
 *  building's), construction quarters of one building, and whether its first payment falls in the quarter building
 *  starts (no separate power stage) or the next. A campus also lists every building's go-live quarter in `etaQs`
 *  (absent: the one building at etaQ); each building has the same construction time and an equal share of the capex. */
export interface SiteSchedule { etaQ: number; buildQ: number; firstNow: boolean; etaQs?: number[] }
/** Go-live quarters of a schedule's buildings. */
export const scheduleEtas = (sch: SiteSchedule): number[] => sch.etaQs ?? [sch.etaQ];

/** Construction interest one building's lease capitalises (FIN4r, M3): funded at its go-live ÷ the lessor's share of
 *  its capex. The lessor's money accrues its rate quarterly to go-live (sitesQ): the upfront part paid at the start
 *  accrues over the whole ETA; each building payment (equal parts, one a quarter) only from when it is paid. */
export function buildingGrowth(r: number, etaQ: number, sch: SiteSchedule): number {
  const g = (q: number) => Math.pow(1 + r, q / 4);
  const k0 = sch.firstNow ? 0 : 1;
  const n = sch.buildQ - k0;
  let build = 0;
  if (n <= 0) build = 1;
  else for (let k = k0; k < sch.buildQ; k++) build += g(sch.buildQ - k) / n;
  return BUILD_Q.upfront * g(etaQ) + (1 - BUILD_Q.upfront) * build;
}

/** Construction interest a site lease capitalises: the mean over its buildings (each its own share of the capex, each
 *  leased at its own go-live). */
export function constructionGrowth(r: number, sch: SiteSchedule): number {
  const etas = scheduleEtas(sch);
  return etas.reduce((a, e) => a + buildingGrowth(r, e, sch), 0) / etas.length;
}

/**
 * Payment options for `amount` of capex, compared on total cost over the asset's life (spec §4). `asset` 'site' leases
 * the 80% share over 15 years (you pay the other 20% in cash); 'chips' lease the whole balance over 5 years or borrow
 * up to 60% of its collateral value at the chip-loan rate for the 4-year loan. Construction interest on a site lease is
 * capitalised while it is built (`schedule`, `constructionGrowth`; none without one). `upfront` (a chip deposit) is paid
 * in cash whichever option you pick and counts in every total.
 */
export function payOptions(s: GameStateV2, amount: Money, asset: 'site' | 'chips', schedule?: SiteSchedule, upfront = 0): PayOption[] {
  const out: PayOption[] = [{ id: 'cash', label: 'Cash', total: amount, now: amount, perYear: 0, years: 0, note: 'paid on the build or delivery schedule' }];
  const r = leaseRate(s);
  const guarantor = leaseGuarantor(s);
  const years = asset === 'site' ? CAPEX_LEASE.years.site : CAPEX_LEASE.years.chips;
  const share = asset === 'site' ? CAPEX_LEASE.siteShare : 1;
  const funded = amount * share * (asset === 'site' && schedule && r !== undefined ? constructionGrowth(r, schedule) : 1);
  const perYear = r !== undefined ? funded * crf(r, years) : 0;
  out.push({ id: 'lease', label: 'Lease', total: amount * (1 - share) + perYear * years, now: amount * (1 - share), perYear, years, ...(r !== undefined ? { rate: r } : { blocked: leaseAvailable(s) as string }), note: `${Math.round(share * 100)}% funded by the lessor; ${years} y of payments from ${asset === 'site' ? 'go-live' : 'delivery'}${guarantor ? `; guaranteed by ${guarantor}: the B rate + ${Math.round(CAPEX_LEASE.guaranteePremium * 100)} pts` : ''}`, ...(guarantor ? { guarantor } : {}) });
  if (asset === 'chips') {
    const loan = amount * DEBT_SIZING.chipLTV * DEBT_SIZING.chipHaircut;
    const rate = (s.capital.sofr + CHIP_LOAN_SPREAD_BP[s.player.finance.rating] / 100) / 100;
    const n = DEBT_TERMS.gpuTerm.years;
    out.push({ id: 'loan', label: 'Chip loan', total: amount + loan * rate * n, now: amount - loan, perYear: loan * rate, years: n, rate, note: `borrows ${Math.round(DEBT_SIZING.chipLTV * DEBT_SIZING.chipHaircut * 100)}% of the balance against the chips (within your chip-loan room); interest only, principal due after ${n} y` });
  }
  for (const o of out) {
    o.total += upfront;
    o.now += upfront;
  }
  return out;
}
