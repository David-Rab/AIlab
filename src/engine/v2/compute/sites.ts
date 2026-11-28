// Data-centre sites: permits → power and construction side by side → live; installs (DATACENTERS.md §3, DC-TASKS
// [D-4]..[D-7]). The power wait is fixed at commitment from the world wait (compute/waits.ts). Owner: WS3.
import { BUILD_TIME_EXP, CAMPUS, CAPEX_LEASE, COMMUNITY, FACILITY_PER_GW, LESSOR, LEVERS, OPPOSITION, RENT, SITE_MIN_MW, SITE_UPFRONT, SOURCES, type CampusBuildings, type SiteSource } from '../../../data/v2/deals';
import { crf, siteLeaseId, type SiteSchedule } from '../finance/capex';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../core/time';
import type { Day, EngineSystem, GameStateV2, Money, Site, SiteWS3, SystemCtx } from '../types';
import { ensureWs3 } from '../finance/ext';
import { addLedger, qOf, yearStats, bookCash } from '../finance/ledger';
import { kWPerH100eAt, siteCapacityH, siteLiveMW } from './power';

export { siteLiveMW };
import { worldWaitQ } from './waits';
import { PUBLIC } from '../world/public';

/** Player sites at Jul 2025 (DC-TASKS [D-10]; no building above 1 GW): S1 rented hall and S2 grid site live (0.6 GW, 0.5M
 *  H100e), S3 Lone Pine gas campus of 4 × 300 MW (1.2 GW) building, all four live together in Apr 2026, S4 Red River
 *  1 GW grid: permits done, 17 q power wait, construction from Q4 27, live Q4 29. */
export function initialSites(startDate: string): Site[] {
  const base = { crash: false, communityPackage: false, spvFunded: 0 };
  const d = (date: string) => dayOfDate(startDate, date);
  const redRiverCapex = 14.2;
  const sites: Site[] = [
    { ...base, id: 'S1', name: 'Abilene North', region: 'US', path: 'rent', mw: 300, stage: 'live', stageEndDay: 0, capex: 0, capexPaid: 0, installed: 250000, ws3: { rolled: true, delayedQ: 0, buildQ: 0, powerQ: 1, startDay: -500, liveDay: d('2024-01-01') } },
    { ...base, id: 'S2', name: 'Abilene South', region: 'US', path: 'grid', mw: 300, stage: 'live', stageEndDay: 0, capex: 0.3 * 14.2, capexPaid: 0.3 * 14.2, installed: 250000, ws3: { rolled: true, delayedQ: 0, buildQ: 8, powerQ: 0, startDay: -700, liveDay: d('2024-07-01') } },
    { ...base, id: 'S3', name: 'Lone Pine', region: 'US', path: 'gas', mw: 1200, stage: 'building', stageEndDay: d('2026-04-01'), capex: 12, capexPaid: 6, installed: 0, ws3: { rolled: true, delayedQ: 0, buildQ: 6, powerQ: 0, startDay: -450, powerDay: d('2026-04-01'), liveAt: d('2026-04-01'), buildings: 4, buildingMW: 300, liveDays: [d('2026-04-01'), d('2026-04-01'), d('2026-04-01'), d('2026-04-01')] } },
    { ...base, id: 'S4', name: 'Red River', region: 'US', path: 'grid', mw: 1000, stage: 'power', stageEndDay: d('2027-10-01'), capex: redRiverCapex, capexPaid: 0.05 * redRiverCapex, installed: 0, ws3: { rolled: true, delayedQ: 0, buildQ: 8, powerQ: 17, startDay: d('2025-04-01'), powerDay: d('2029-10-01'), liveAt: d('2029-10-01') } },
  ];
  return sites;
}

/** Test override of local opposition: when a test sets `LOCAL_MOOD.dcNimby` to a number it wins over the rule below. */
export const LOCAL_MOOD: { dcNimby: number | undefined } = { dcNimby: undefined };
/** Local data-centre opposition 0..100 (spec §5; world/public.ts, W4): 45 at concern 50 (the calibrated F10 case, mood 0.9;
 *  scripts/v2/finance.ts), up with concern, 10 lower under the community package policy. */
export const localMood = (s: GameStateV2) =>
  LOCAL_MOOD.dcNimby ?? 45 + PUBLIC.concernToNimby * (s.public.concern - 50) - (s.player.policies.communityBenefits ? PUBLIC.communityNimbyCut : 0);
/** Local opposition strength 0–1 (AntiAI = localMood / 100). */
const localOpposition = (s: GameStateV2) => Math.max(0, Math.min(1, localMood(s) / 100));

/** Odds that the large reactive package (E27) unblocks a blocked site: 0.85 − 0.5 × local opposition, ≥ 0.3 [D]. */
export const reactiveUnblockOdds = (s: GameStateV2) => Math.max(COMMUNITY.unblockMin, COMMUNITY.unblockBase - COMMUNITY.unblockPerAnti * localOpposition(s));

/** What the opposition odds are made of (DATACENTERS §5; [D-6]): the source's base block / delay chance, the public
 *  mood factor (localMood ÷ 50), the crash-construction factor (× 1.5) and the community package's block factor
 *  (× 0.5), then `block` and `delay` after the caps (block ≤ 0.5, delay ≤ 0.9 − block). Rent has none (bases 0). A site
 *  re-permitting after the E27 reactive package is blocked again with 1 − its unblock odds, never delayed (base =
 *  that, all factors 1). */
export interface OppositionParts { blockBase: number; delayBase: number; mood: number; crashMult: number; communityMult: number; block: number; delay: number }
export function oppositionParts(s: GameStateV2, site: Pick<Site, 'path' | 'crash' | 'communityPackage'> & { ws3?: Pick<SiteWS3, 'reactive'> }): OppositionParts {
  if (site.path === 'rent') return { blockBase: 0, delayBase: 0, mood: 1, crashMult: 1, communityMult: 1, block: 0, delay: 0 };
  if (site.ws3?.reactive) { const p = 1 - reactiveUnblockOdds(s); return { blockBase: p, delayBase: 0, mood: 1, crashMult: 1, communityMult: 1, block: p, delay: 0 }; }
  const src = SOURCES[site.path];
  const mood = Math.max(0, localMood(s)) / OPPOSITION.moodRef;
  const crashMult = site.crash ? LEVERS.crash.oddsMult : 1;
  const communityMult = site.communityPackage ? LEVERS.community.blockMult : 1;
  const block = Math.min(OPPOSITION.blockMax, src.blockBase * mood * crashMult * communityMult);
  const delay = Math.max(0, Math.min(OPPOSITION.delayMax - block, src.delayBase * mood * crashMult));
  return { blockBase: src.blockBase, delayBase: src.delayBase, mood, crashMult, communityMult, block, delay };
}

/** Opposition roll at the end of permits: the block and delay odds of oppositionParts (delay 1–3 quarters). */
export function oppositionOdds(s: GameStateV2, site: Parameters<typeof oppositionParts>[1]): { block: number; delay: number } {
  const { block, delay } = oppositionParts(s, site);
  return { block, delay };
}

/** Label of a block chance: < 4% low, < 10% medium, else high [D-6]. */
export const oppositionLevel = (block: number): 'low' | 'medium' | 'high' => (block < 0.04 ? 'low' : block < 0.1 ? 'medium' : 'high');

/** Site options of the build card. `mw`: the size of one building (DATACENTERS §5b; rent: the hall); `buildings`: 1, 3
 *  or 5 of them on one campus (default 1; rent always 1), so the site is mw × buildings. `pay`: cash, or a financing
 *  lease of 80% of capex (spec §4). `community` defaults to the company policy (policies.communityBenefits). Rent takes
 *  no speed-ups and no community package. */
export interface SiteOpts { path: SiteSource; mw: number; buildings?: CampusBuildings; crash?: boolean; rush?: boolean; fastTrack?: boolean; community?: boolean; pay?: 'cash' | 'lease'; leaseRate?: number; region?: Site['region']; name?: string }

/** The options as the engine applies them: rent's levers forced off. */
const levers = (o: SiteOpts): SiteOpts => (o.path === 'rent' ? { ...o, crash: false, rush: false, fastTrack: false, community: false } : o);

/** Buildings on the site: rent 1, else the option (default 1). */
export const siteBuildings = (o: Pick<SiteOpts, 'path' | 'buildings'>): number => (o.path === 'rent' ? 1 : o.buildings ?? 1);
/** The whole site's MW: building MW × buildings. */
export const campusMW = (o: Pick<SiteOpts, 'path' | 'mw' | 'buildings'>) => o.mw * siteBuildings(o);
const fmtMW = (mw: number) => (mw >= 1000 ? `${+(mw / 1000).toFixed(2)} GW` : `${Math.round(mw)} MW`);
/** The options as newSite builds them: the building clamped to [100 MW, the source's cap] and the buildings the
 *  largest of 1 / 3 / 5 that is at most the asked count and whose campus total fits the cap (rent: 1). Callers check
 *  siteSizeError first; this is what is left when they did not. */
export function siteFit(o: SiteOpts): SiteOpts {
  const cap = SOURCES[o.path].maxMW;
  const mw = Math.max(SITE_MIN_MW, Math.min(cap, o.mw));
  const asked = siteBuildings(o);
  const buildings = (o.path === 'rent' ? 1 : [...CAMPUS.counts].reverse().find((c) => c <= asked && c * mw <= cap + 1e-9) ?? 1) as CampusBuildings;
  return { ...o, mw, buildings };
}
/** Why these options cannot be built, or undefined: buildings not 1, 3 or 5, or the campus total over the source's
 *  size cap (grid and rent ≤ 1 GW, gas ≤ 5 GW per site; DATACENTERS §5b). */
export function siteSizeError(o: SiteOpts): string | undefined {
  const n = siteBuildings(o);
  if (!(CAMPUS.counts as readonly number[]).includes(n)) return 'A campus has 1, 3 or 5 buildings';
  const max = SOURCES[o.path].maxMW;
  if (campusMW(o) > max + 1e-9) return `${n} × ${fmtMW(o.mw)} = ${fmtMW(campusMW(o))} is more than one ${o.path} site holds (${fmtMW(max)})`;
  return undefined;
}

/** Permit quarters: the source's, − 1 with fast-track (gas 2 → 1, grid 1 → 0). */
export const sitePermitQ = (o: SiteOpts) => Math.max(0, SOURCES[o.path].permitQ - (levers(o).fastTrack ? LEVERS.fastTrack.permitQ : 0));
/** Construction quarters of one building (`o.mw`): rent 0 (the landlord builds); else the source's × (building GW)^0.4
 *  (bigger buildings take longer, more slowly than their size), × 0.5 with crash construction, at least 1. */
export const siteBuildQ = (o: SiteOpts) => (o.path === 'rent' ? 0
  : Math.max(1, Math.round(SOURCES[o.path].buildQ * Math.pow(o.mw / 1000, BUILD_TIME_EXP) * (levers(o).crash ? LEVERS.crash.buildMult : 1))));

/** Power wait in whole quarters, fixed at commitment from today's world wait before the new site joins the queue
 *  [D-4]: grid max(1, round(W × 0.75 if rushed)); gas rushed min(round(W), 4), else max(1, round(W)); rent max(1, round(W)). */
export function sitePowerQ(s: GameStateV2, o: SiteOpts): number {
  const w = worldWaitQ(s, o.path);
  const rush = !!levers(o).rush;
  if (o.path === 'grid') return Math.max(1, Math.round(w * (rush ? LEVERS.rushGrid.waitMult : 1)));
  if (o.path === 'gas' && rush) return Math.min(Math.round(w), LEVERS.rushGas.waitQ);
  return Math.max(1, Math.round(w));
}

/** Quarters from commitment to each building going live (DATACENTERS §5b): building k (k = 0, 1, …) at permits +
 *  max(power, construction + k); rent: its power (hall) wait. */
export function siteBuildingLiveInQ(s: GameStateV2, o: SiteOpts): number[] {
  if (o.path === 'rent') return [sitePowerQ(s, o)];
  const p = sitePermitQ(o), b = siteBuildQ(o), w = sitePowerQ(s, o);
  return Array.from({ length: siteBuildings(o) }, (_, k) => p + Math.max(w, b + k));
}
/** Quarters from commitment to the first building live: permits + max(construction, power); rent: its hall wait. */
export function siteLiveInQ(s: GameStateV2, o: SiteOpts): number {
  return siteBuildingLiveInQ(s, o)[0];
}
/** Quarters to the last building live (= siteLiveInQ for one building). */
export function siteLastLiveInQ(s: GameStateV2, o: SiteOpts): number {
  const q = siteBuildingLiveInQ(s, o);
  return q[q.length - 1];
}

/** What a site's capex ($B, the whole campus) is made of (DATACENTERS §5b): `building` before the repetition saving
 *  (rent: the network fit-out), `repeatSaving` (building × the 3-building 10% / 5-building 15% discount), `extra`
 *  (turbines, utility upgrades), `crash` 35% and `fastTrack` 5% of the discounted building, `rush` (grid $0.3B/GW; gas
 *  30% of the turbines) and `community` $1B/GW; extra, rush and community are undiscounted. `total` = building −
 *  repeatSaving + the rest. */
export interface CapexParts { building: Money; repeatSaving: Money; extra: Money; crash: Money; rush: Money; fastTrack: Money; community: Money; total: Money }
export function siteCapexParts(o: SiteOpts): CapexParts {
  const x = levers(o);
  const src = SOURCES[o.path];
  const gw = campusMW(o) / 1000;
  const building = src.upfrontPerGW;
  const discount = o.path === 'rent' ? 0 : CAMPUS.discount[siteBuildings(o) as CampusBuildings] ?? 0;
  const net = building * (1 - discount);
  const rush = x.rush ? (o.path === 'grid' ? LEVERS.rushGrid.perGW : o.path === 'gas' ? LEVERS.rushGas.turbineShare * src.extraPerGW : 0) : 0;
  const crash = x.crash ? LEVERS.crash.buildingShare * net : 0;
  const fastTrack = x.fastTrack ? LEVERS.fastTrack.buildingShare * net : 0;
  const community = x.community ? LEVERS.community.perGW : 0;
  return {
    building: gw * building, repeatSaving: gw * building * discount, extra: gw * src.extraPerGW, crash: gw * crash, rush: gw * rush,
    fastTrack: gw * fastTrack, community: gw * community, total: gw * (net + src.extraPerGW + crash + rush + fastTrack + community),
  };
}

/** Capex ($B) of a new site: siteCapexParts' total. */
export const siteCapex = (o: SiteOpts): Money => siteCapexParts(o).total;

/** Add the community package ($1B per GW, block odds × 0.5) to a site not yet past its permitting roll. Returns false
 *  if it cannot take one. */
export function addCommunityPackage(site: Site): boolean {
  if (site.communityPackage || site.ws3.rolled || site.stage !== 'permitting' || site.path === 'rent') return false;
  site.communityPackage = true;
  site.capex += (site.mw / 1000) * LEVERS.community.perGW;
  return true;
}

/** What one speed-up does at the build card's current toggles: `on` (as given), quarters it saves (first building;
 *  `savesLastQ`: last building), its price ($B of capex) and, for the community package, the factor on the block odds.
 *  Each is the difference between the same site with that lever forced on and forced off, the other toggles as given
 *  (so crash saves 0 q on plain gas and 4 q with rush power). Rent has none: the object is empty. */
export interface LeverEffect { on: boolean; savesQ: number; savesLastQ: number; cost: Money; blockMult?: number }
export type LeverKey = 'crash' | 'rush' | 'fastTrack' | 'community';
export function leverEffects(s: GameStateV2, o: SiteOpts): Partial<Record<LeverKey, LeverEffect>> {
  if (o.path === 'rent') return {};
  const out: Partial<Record<LeverKey, LeverEffect>> = {};
  for (const k of ['crash', 'rush', 'fastTrack', 'community'] as const) {
    const on = { ...o, [k]: true }, off = { ...o, [k]: false };
    out[k] = {
      on: !!o[k], savesQ: k === 'community' ? 0 : siteLiveInQ(s, off) - siteLiveInQ(s, on),
      savesLastQ: k === 'community' ? 0 : siteLastLiveInQ(s, off) - siteLastLiveInQ(s, on), cost: siteCapex(on) - siteCapex(off),
      ...(k === 'community' ? { blockMult: LEVERS.community.blockMult } : {}),
    };
  }
  return out;
}

/** Expected construction schedule of a new site (the lease preview's construction interest, FIN4r M3): quarters to
 *  go-live (the first building's; a campus lists every building's in `etaQs`), construction quarters of a building,
 *  and whether the first construction payment falls in the quarter construction starts. The engine always pays then
 *  (equal parts over the construction quarters [D-7]), so `firstNow` is true. Each building has its own lease from its
 *  own go-live (DC-15). */
export function siteSchedule(s: GameStateV2, o: SiteOpts): SiteSchedule {
  const q = siteBuildingLiveInQ(s, o);
  return { etaQ: q[0], buildQ: siteBuildQ(o), firstNow: true, ...(q.length > 1 ? { etaQs: q } : {}) };
}

const SOURCE_LABEL: Record<SiteSource, string> = { rent: 'rented hall', grid: 'grid', gas: 'gas' };

/** Start a new site (one building or a campus of 3 or 5). Pays 5% (SITE_UPFRONT) of the whole capex now (your
 *  share). Its power wait is fixed now [D-4]. Rent waits for its hall and adds the 5-year rent from go-live; grid and gas
 *  start permits (fast-tracked grid has none and rolls its opposition now). A financing lease (`pay: 'lease'`, not for
 *  rent) has the lessor fund 80% of capex as it is spent. Callers check siteSizeError first; here the building is
 *  fitted (siteFit). */
export function newSite(s: GameStateV2, ctx: SystemCtx, o: SiteOpts): Site {
  ensureWs3(s);
  const rent = o.path === 'rent';
  const opts = levers(siteFit(o));
  const n = siteBuildings(opts), bmw = opts.mw, mw = campusMW(opts);
  const leased = o.pay === 'lease' && !rent && o.leaseRate !== undefined;
  const spvFunded = leased ? CAPEX_LEASE.siteShare : 0;
  const q = qOf(s);
  const start = s.time.startDate;
  const id = `S${s.player.sites.length + 1}-${s.time.day}`;
  const powerQ = sitePowerQ(s, opts); // today's wait, before this site joins the queue
  const permitQ = sitePermitQ(opts);
  const site: Site = {
    id, name: o.name ?? `${rent ? 'Hall' : 'Site'} ${s.player.sites.length + 1}`, region: o.region ?? 'US', path: o.path, mw,
    stage: rent ? 'power' : 'permitting', stageEndDay: 0, crash: !!opts.crash,
    capex: siteCapex(opts), capexPaid: 0, installed: 0, communityPackage: !!opts.community, spvFunded,
    ws3: { rolled: rent, delayedQ: 0, startDay: s.time.day, buildQ: siteBuildQ(opts), powerQ, buildings: n, buildingMW: bmw,
      ...(opts.rush ? { rush: true } : {}), ...(opts.fastTrack ? { fastTrack: true } : {}) },
  };
  if (leased) site.ws3.lease = { rate: o.leaseRate as number, funded: 0, byBuilding: Array.from({ length: n }, () => 0), booked: 0 };
  if (rent) {
    site.stageEndDay = site.ws3.powerDay = site.ws3.liveAt = dayOfQuarter(start, q + powerQ);
    site.ws3.liveDays = [site.ws3.liveAt];
    yearStats(s).leaseFinanced += (mw / 1000) * FACILITY_PER_GW; // facility capex the landlord funds
    addLedger(s, { id: `L-rent-${id}`, payee: 'Data-centre rent', kind: 'lease', perQuarter: ((mw / 1000) * RENT.perGWYear) / 4, startDay: site.stageEndDay, endDay: site.stageEndDay + RENT.years * 365, cancellableNoticeQ: null, penalty: 0 });
  } else site.stageEndDay = dayOfQuarter(start, q + permitQ);
  s.player.sites.push(site);
  payCapex(s, ctx, site, site.capex * SITE_UPFRONT);
  const extras = [opts.crash && 'crash construction', opts.rush && 'rush power', opts.fastTrack && 'fast-track permits'].filter(Boolean).join(', ');
  ctx.log('company', `${site.name}: ${n > 1 ? `${n} × ${fmtMW(bmw)} ` : `${(mw / 1000).toFixed(1)} GW `}${SOURCE_LABEL[o.path]}${n > 1 ? ' campus' : ''} started${extras ? ` (${extras})` : ''}${leased ? ` (${Math.round(spvFunded * 100)}% funded by ${LESSOR} at ${((o.leaseRate as number) * 100).toFixed(0)}%)` : ''}.`);
  if (!rent && permitQ === 0) advanceSite(s, ctx, site, q); // fast-track grid: permits end now, the roll happens now
  return site;
}

/** Pay `amount` of a site's capex: a leased site's lessor funds its share (tallied as financing; it accrues to the
 *  amount the lease repays), split equally over the buildings `paying` (default: all) that the payment is for. */
function payCapex(s: GameStateV2, ctx: SystemCtx, site: Site, amount: Money, paying?: number[]) {
  const amt = Math.min(amount, site.capex - site.capexPaid);
  if (amt <= 0) return;
  site.capexPaid += amt;
  const own = amt * (1 - site.spvFunded);
  const ys = yearStats(s);
  ys.capexSites += own;
  ys.capexSitesFinanced += amt - own;
  ys.spvFinanced += amt - own;
  const L = site.ws3.lease;
  if (L) {
    const ks = paying ?? L.byBuilding.map((_, k) => k);
    for (const k of ks) L.byBuilding[k] += (amt - own) / ks.length;
    L.funded = L.byBuilding.reduce((a, b) => a + b, 0);
  }
  if (own > 0) bookCash(s, ctx, -own, 'compute', 'site capex', site.name);
}

/** The financing lease a leased site pays on `funded` (default: all it has funded, with construction interest) ×
 *  CRF(r, 15 y) a year (spec §4); one building's lease takes that building's funded amount. */
export function siteLeasePerYear(site: Site, funded = site.ws3.lease?.funded ?? 0): Money {
  return site.ws3.lease ? funded * crf(site.ws3.lease.rate, CAPEX_LEASE.years.site) : 0;
}

/** Permits are over (un-blocked) in quarter `pq`: power is ready powerQ quarters later; building k goes live at pq +
 *  max(power, construction + k), its construction timed to end then (DATACENTERS §5b) [D-4]. */
function schedule(s: GameStateV2, site: Site, pq: number) {
  const w = site.ws3;
  const start = s.time.startDate;
  w.powerDay = dayOfQuarter(start, pq + w.powerQ);
  w.liveDays = Array.from({ length: w.buildings ?? 1 }, (_, k) => dayOfQuarter(start, pq + Math.max(w.powerQ, w.buildQ + k)));
  w.liveAt = w.liveDays[0];
  const buildStart: Day = dayOfQuarter(start, pq + Math.max(w.buildQ, w.powerQ) - w.buildQ);
  if (buildStart <= s.time.day) startBuilding(s, site);
  else {
    site.stage = 'power';
    site.stageEndDay = buildStart;
  }
}

function startBuilding(s: GameStateV2, site: Site) {
  site.stage = 'building';
  site.stageEndDay = site.ws3.liveAt ?? site.stageEndDay;
  site.ws3.buildStartDay = s.time.day;
}

/** Every building is live: the rest of the capex is paid (for the buildings whose lease has not started yet). */
function goLive(s: GameStateV2, ctx: SystemCtx, site: Site) {
  const L = site.ws3.lease;
  payCapex(s, ctx, site, site.capex - site.capexPaid, L && Array.from({ length: L.byBuilding.length - L.booked }, (_, i) => L.booked + i));
  if (site.stage !== 'live') {
    site.stage = 'live';
    site.ws3.liveDay = s.time.day;
  }
  ctx.log('company', `${site.name} is live: ${(site.mw / 1000).toFixed(1)} GW.`);
}

/** Start the financing lease of every building of a leased site that is live (the first `live`) and has none yet: its
 *  funded amount (with construction interest, which stops here) × CRF(r, 15 y) a year for 15 years from today (DC-15).
 *  A campus's entries are `-b0` … and one contract; a single building keeps the site's lease id. */
function startLeases(s: GameStateV2, ctx: SystemCtx, site: Site, live: number) {
  const L = site.ws3.lease;
  if (!L) return;
  const n = L.byBuilding.length;
  const years = CAPEX_LEASE.years.site;
  for (; L.booked < live; L.booked++) {
    const k = L.booked;
    const perYear = siteLeasePerYear(site, L.byBuilding[k]);
    addLedger(s, { id: n > 1 ? `${siteLeaseId(site.id)}-b${k}` : siteLeaseId(site.id), ...(n > 1 ? { contract: siteLeaseId(site.id) } : {}), payee: LESSOR, kind: 'finLease', perQuarter: perYear / 4, startDay: s.time.day, endDay: s.time.day + years * 365, cancellableNoticeQ: null, penalty: 0, rate: L.rate });
    ctx.log('finance', `${site.name}: ${n > 1 ? `building ${k + 1} of ${n}: ` : ''}lease to ${LESSOR} starts, $${perYear.toFixed(2)}B a year for ${years} years (funded $${L.byBuilding[k].toFixed(1)}B at ${(L.rate * 100).toFixed(0)}%).`);
  }
}

/** Go-live days of a site's buildings (ws3.liveDays; a site without them is one building live at liveAt). */
const liveDaysOf = (site: Site): Day[] => site.ws3.liveDays ?? [site.ws3.liveAt ?? site.stageEndDay];
/** Is a live campus still building (its last building goes live on or after `day`)? */
const stillBuilding = (site: Site, day: Day) => site.stage === 'live' && !!site.ws3.liveDays && site.ws3.liveDays[site.ws3.liveDays.length - 1] >= day;

/** Construction quarter of a site in stage building or live (DATACENTERS §5b). The site is live from its first
 *  building's day; when the last is live, goLive. Otherwise each building under construction (k = 0 from the stage,
 *  later ones from live day − construction quarters) pays an equal part of what it has left a quarter: the capex left,
 *  less a full share (95% ÷ buildings) for each building not started, spread over the quarters they have left. One
 *  building: (capex − paid) ÷ quarters left, as before. */
function buildStep(s: GameStateV2, ctx: SystemCtx, site: Site) {
  const day = s.time.day;
  const start = s.time.startDate;
  const days = liveDaysOf(site);
  const n = days.length;
  let live = 0, before = 0;
  for (const d of days) { if (d <= day) live++; if (d < day) before++; }
  if (live === n) {
    goLive(s, ctx, site);
    return startLeases(s, ctx, site, n);
  }
  if (live > 0 && site.stage !== 'live') {
    site.stage = 'live';
    site.ws3.liveDay = day;
  }
  if (live > before) ctx.log('company', `${site.name}: building ${live} of ${n} live (${fmtMW(siteLiveMW(site, day))} of ${fmtMW(site.mw)}).`);
  const share = (site.capex * (1 - SITE_UPFRONT)) / n;
  let unstarted = 0, qLeft = 0;
  const building: number[] = [];
  days.forEach((d, k) => {
    if (d <= day) return;
    const started = k === 0 || dayOfQuarter(start, quarterIndex(start, d) - site.ws3.buildQ) <= day;
    if (!started) { unstarted++; return; }
    building.push(k);
    qLeft += Math.max(1, Math.round((d - day) / 91));
  });
  if (building.length > 0) payCapex(s, ctx, site, (Math.max(0, site.capex - site.capexPaid - unstarted * share) * building.length) / qLeft, building);
  startLeases(s, ctx, site, live);
}

/** Run a site's due stage changes in quarter `q` (sitesQ, and newSite for a fast-tracked grid site). Permits end: the
 *  opposition roll (once), then the schedule. Power due: construction starts (rent: live). Construction: buildStep (an
 *  equal part a quarter of each building's capex left; the site is live from the first building, done at the last). */
function advanceSite(s: GameStateV2, ctx: SystemCtx, site: Site, q: number) {
  const day = s.time.day;
  if (site.stage === 'permitting') {
    if (site.stageEndDay > day) return;
    if (!site.ws3.rolled) {
      const rng = ctx.rng('market');
      site.ws3.rolled = true;
      const odds = oppositionOdds(s, site);
      const u = rng.float();
      delete site.ws3.reactive;
      if (u < odds.block) {
        site.stage = 'blocked';
        ctx.log('alert', `${site.name} blocked by local opposition. ${(site.capexPaid).toFixed(1)}B spent is lost.`, 3);
        ctx.headline(`block-${site.id}`, `Town votes down AI data centre: ${site.name}`);
        return;
      }
      if (u < odds.block + odds.delay) {
        const [lo, hi] = OPPOSITION.delayQ;
        const d = lo + Math.floor(rng.float() * (hi - lo + 1));
        site.ws3.delayedQ += d;
        site.stageEndDay = dayOfQuarter(s.time.startDate, q + d);
        ctx.log('company', `${site.name}: permits delayed ${d} quarter${d > 1 ? 's' : ''} by local opposition.`);
        return;
      }
    }
    schedule(s, site, q);
  }
  if (site.stage === 'power') {
    if (site.stageEndDay > day) return;
    if (site.path === 'rent') return goLive(s, ctx, site);
    startBuilding(s, site);
  }
  if (site.stage === 'building' || site.stage === 'live') buildStep(s, ctx, site);
}

/** Advance one site by a quarter. Construction interest on the lessor's money is capitalised quarterly (it is repaid
 *  through the lease): on each building until its lease starts. */
function stepSite(s: GameStateV2, ctx: SystemCtx, site: Site, q: number) {
  const L = site.ws3.lease;
  if (L) {
    const g = Math.pow(1 + L.rate, 0.25);
    for (let k = L.booked; k < L.byBuilding.length; k++) L.byBuilding[k] *= g;
    L.funded = L.byBuilding.reduce((a, b) => a + b, 0);
  }
  advanceSite(s, ctx, site, q);
}

/** Install installable inventory into live sites with free MW in their live buildings (1-quarter install lag, R15 §1.3). */
export function installInventory(s: GameStateV2): number {
  const inv = s.player.finance.ws3.inventory;
  if (inv.ready <= 0) return 0;
  let put = 0;
  for (const site of s.player.sites) {
    if (site.stage !== 'live' || inv.ready <= 0) continue;
    const free = siteCapacityH(s, siteLiveMW(site, s.time.day)) - site.installed;
    if (free <= 0) continue;
    const n = Math.min(free, inv.ready);
    site.installed += n;
    inv.ready -= n;
    put += n;
  }
  if (put > 0) {
    const share = put / (put + inv.ready + inv.transit);
    const book = inv.book * share;
    inv.book -= book;
    s.player.finance.ws3.chipBook += book;
  }
  return put;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const WAIT_SOURCES: readonly SiteSource[] = ['grid', 'gas', 'rent'];

/** sitesQ (410, quarterly): kW efficiency, the waits' history, site stages and rolls, capex, installs. */
export const sitesQSystem: EngineSystem = {
  id: 'sitesQ', owner: 'WS3', cadence: 'quarterly', order: 410, system: 'compute',
  run(s, ctx) {
    ensureWs3(s);
    const q = qOf(s);
    const pw = s.power;
    if (q > 0) pw.kWPerH100e = kWPerH100eAt(pw.kWPerH100e, 1); // 1.26×/yr efficiency: 0.93 → 0.70 at Q4 2026 [R15, AI27]
    for (const src of WAIT_SOURCES) pw.waitHist[src].push(round1(worldWaitQ(s, src)));
    for (const site of s.player.sites) if ((site.stage !== 'live' || stillBuilding(site, s.time.day)) && site.stage !== 'blocked') stepSite(s, ctx, site, q);
    installInventory(s);
  },
};
