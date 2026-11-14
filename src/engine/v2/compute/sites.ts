// Data-centre sites: permitting → power → building → live; grid pool; installs (V2-SPEC §3.8; research/15 §1.3).
// Owner: WS3.
import { BUILD_Q, DEAL_TERMS, FACILITY_PER_GW, LEASE, SITE_PATHS } from '../../../data/v2/deals';
import { dayOfDate, dayOfQuarter } from '../core/time';
import type { BaselineId, EngineSystem, GameStateV2, Money, Site, SystemCtx } from '../types';
import { defaultSiteWS3, ensureWs3 } from '../finance/ext';
import { addLedger, qOf, yearStats, bookCash } from '../finance/ledger';
import { siteCapacityH } from './power';

/** Player sites at Jul 2025 (§3.7.2): 2 live (0.6 GW, 0.5M H100e), S3 1.2 GW building, S4 2 GW permitting (grid). */
export function initialSites(baseline: BaselineId, startDate: string): Site[] {
  const k = baseline === 'reality' ? 0.85 : 1;
  const base = { crash: false, communityPackage: false, spvFunded: 0 };
  const sites: Site[] = [
    { ...base, id: 'S1', name: 'Abilene North', region: 'US', path: 'lease', mw: 300, stage: 'live', stageEndDay: 0, capex: 0, capexPaid: 0, installed: 250000 * k, ws3: { rolled: true, delayedQ: 0, buildQ: 2, startDay: -500 } },
    { ...base, id: 'S2', name: 'Abilene South', region: 'US', path: 'brownfield', mw: 300, stage: 'live', stageEndDay: 0, capex: 4.2, capexPaid: 4.2, installed: 250000 * k, ws3: { rolled: true, delayedQ: 0, buildQ: 8, startDay: -700 } },
    { ...base, id: 'S3', name: 'Lone Pine', region: 'US', path: 'gas', mw: 1200, stage: 'building', stageEndDay: dayOfDate(startDate, '2026-04-01'), capex: 12 * k, capexPaid: 6 * k, installed: 0, ws3: { rolled: true, delayedQ: 0, buildQ: 8, startDay: -450 } },
    // S4's interconnection request was filed in early 2023: queue credit shortens its power stage [D].
    { ...base, id: 'S4', name: 'Red River', region: 'US', path: 'grid', mw: 2000, stage: 'permitting', stageEndDay: dayOfDate(startDate, '2026-07-01'), capex: 29 * k, capexPaid: 0, installed: 0, ws3: { rolled: false, delayedQ: 0, buildQ: 8, startDay: -60, queuedDay: -880 } },
  ];
  return sites;
}

/** Triangular draw (lo, mode, hi). */
function tri(u: number, lo: number, mode: number, hi: number): number {
  if (hi <= lo) return lo;
  const f = (mode - lo) / (hi - lo);
  return u < f ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

/** Opposition roll at the end of permitting (§3.8): p_block = 0.05 + 0.10·AntiAI + 0.05·gas + 0.05·crash, halved by a
 *  community package; p_delay = 0.20 + 0.20·AntiAI (1–3 quarters). AntiAI = pub.dcNimby / 100. */
export function oppositionOdds(s: GameStateV2, site: Pick<Site, 'path' | 'crash' | 'communityPackage'>): { block: number; delay: number } {
  const anti = Math.max(0, Math.min(1, s.pub.dcNimby / 100));
  const gas = SITE_PATHS[site.path].gas ? 1 : 0;
  let block = 0.05 + 0.1 * anti + 0.05 * gas + 0.05 * (site.crash ? 1 : 0);
  if (site.communityPackage) block *= 0.5;
  if (site.path === 'lease') block = 0;
  return { block, delay: site.path === 'lease' ? 0 : 0.2 + 0.2 * anti };
}

export interface SiteOpts { path: Site['path']; mw: number; crash?: boolean; community?: boolean; spv?: boolean; region?: Site['region']; name?: string }

/** Capex ($B) of a new site: GW × path capex/GW × crash 1.35 × community 1.03 [R15]. Lease sites pay network only. */
export function siteCapex(o: SiteOpts): Money {
  const p = SITE_PATHS[o.path];
  return (o.mw / 1000) * p.capexPerGW * (o.crash ? BUILD_Q.crashCapexMult : 1) * (o.community ? BUILD_Q.communityCapexMult : 1);
}

/** Expected quarters until live (preview): permitting + power beyond overlap + building. */
export function siteEtaQ(s: GameStateV2, o: SiteOpts): number {
  const p = SITE_PATHS[o.path];
  if (o.path === 'lease') return 2;
  const build = o.crash ? BUILD_Q.crash : BUILD_Q.normal;
  const powerExtra = Math.max(0, p.powerQ[1] - p.overlapQ);
  const gate = p.needsTransformers && s.power.ws3.transformersGW < o.mw / 1000 ? s.power.transformerLeadQ : 0;
  return p.permitQ + powerExtra + Math.max(build, gate);
}

/** Lease capacity available this quarter (GW). */
export const leaseAvailableGW = (s: GameStateV2) => s.market.ws3.leasePoolGW;

/** Start a new site. Pays 5% now (player share); leases add a ledger entry and draw from the lease pool. */
export function newSite(s: GameStateV2, ctx: SystemCtx, o: SiteOpts): Site {
  ensureWs3(s);
  const p = SITE_PATHS[o.path];
  const mw = Math.max(50, Math.min(p.maxMW, o.mw));
  const opts = { ...o, mw };
  const fx = s.player.finance.ws3;
  const jv = fx.jv && fx.jv.untilDay > s.time.day ? fx.jv : undefined;
  const spvFunded = o.spv && o.path !== 'lease' ? DEAL_TERMS.spv.share : jv && o.path !== 'lease' ? jv.share : 0;
  const q = qOf(s);
  const id = `S${s.player.sites.length + 1}-${s.time.day}`;
  const site: Site = {
    id, name: o.name ?? `${o.path === 'lease' ? 'Colo' : 'Site'} ${s.player.sites.length + 1}`, region: o.region ?? 'US', path: o.path, mw,
    stage: o.path === 'lease' ? 'building' : 'permitting', stageEndDay: 0, crash: !!o.crash,
    capex: siteCapex(opts), capexPaid: 0, installed: 0, communityPackage: !!o.community, spvFunded,
    ws3: { ...defaultSiteWS3({ stage: 'permitting' }), rolled: o.path === 'lease', startDay: s.time.day, buildQ: o.crash ? BUILD_Q.crash : BUILD_Q.normal },
  };
  if (spvFunded > 0) site.ws3.financedBy = o.spv ? 'Keystone Capital' : jv?.partner;
  if (o.path === 'lease') {
    const u = ctx.rng('market').float();
    site.ws3.buildQ = Math.round(tri(u, BUILD_Q.leaseLo, 2, BUILD_Q.leaseHi));
    site.stageEndDay = dayOfQuarter(s.time.startDate, q + site.ws3.buildQ);
    s.market.ws3.leasePoolGW = Math.max(0, s.market.ws3.leasePoolGW - mw / 1000);
    site.ws3.buildStartDay = s.time.day;
    yearStats(s).leaseFinanced += (mw / 1000) * FACILITY_PER_GW; // facility capex the lessor funds
    addLedger(s, { id: `L-lease-${id}`, payee: 'Colocation lease', kind: 'lease', perQuarter: ((mw / 1000) * LEASE.perGWYear) / 4, endDay: site.stageEndDay + LEASE.years * 365, cancellableNoticeQ: null, penalty: 0 });
  } else {
    site.stageEndDay = dayOfQuarter(s.time.startDate, q + Math.max(1, p.permitQ));
    if (p.usesGridPool) {
      site.ws3.queuedDay = s.time.day;
      s.power.queue.push({ siteId: id, gw: mw / 1000 });
    }
  }
  s.player.sites.push(site);
  payCapex(s, ctx, site, site.capex * 0.05);
  ctx.log('company', `${site.name}: ${(mw / 1000).toFixed(1)} GW ${o.path}${o.crash ? ' crash build' : ''} started${spvFunded ? ` (${Math.round(spvFunded * 100)}% partner-funded)` : ''}.`);
  return site;
}

/** Pay `amount` of a site's capex: the partner share is funded by the SPV/JV (tallied as financing). */
function payCapex(s: GameStateV2, ctx: SystemCtx, site: Site, amount: Money) {
  const amt = Math.min(amount, site.capex - site.capexPaid);
  if (amt <= 0) return;
  site.capexPaid += amt;
  const own = amt * (1 - site.spvFunded);
  const ys = yearStats(s);
  ys.capexSites += own;
  ys.capexSitesFinanced += amt - own;
  ys.spvFinanced += amt - own;
  if (own > 0) bookCash(s, ctx, -own, 'compute', 'site capex', site.name);
}

function enterBuilding(s: GameStateV2, ctx: SystemCtx, site: Site, q: number) {
  const p = SITE_PATHS[site.path];
  const gw = site.mw / 1000;
  let build = site.ws3.buildQ;
  if (p.needsTransformers) {
    const pw = s.power.ws3;
    if (pw.transformersGW >= gw) pw.transformersGW -= gw;
    else {
      pw.transformersGW = 0;
      build = Math.max(build, s.power.transformerLeadQ); // transformer gate: 8–10 q lead [R15]
      ctx.log('company', `${site.name}: waiting on transformers (${s.power.transformerLeadQ} q lead time).`);
    }
  }
  site.ws3.buildQ = build;
  site.ws3.buildStartDay = s.time.day;
  site.stage = 'building';
  site.stageEndDay = dayOfQuarter(s.time.startDate, q + build);
}

/** Advance one site by a quarter. */
function stepSite(s: GameStateV2, ctx: SystemCtx, site: Site, q: number) {
  const p = SITE_PATHS[site.path];
  const rng = ctx.rng('market');
  const due = site.stageEndDay <= s.time.day;
  if (site.stage === 'permitting' && due) {
    if (!site.ws3.rolled) {
      site.ws3.rolled = true;
      const odds = oppositionOdds(s, site);
      const u = rng.float();
      if (u < odds.block) {
        site.stage = 'blocked';
        ctx.log('alert', `${site.name} blocked by local opposition. ${(site.capexPaid).toFixed(1)}B spent is lost.`, 3);
        ctx.headline(`block-${site.id}`, `Town votes down AI data centre: ${site.name}`);
        s.power.queue = s.power.queue.filter((x) => x.siteId !== site.id);
        return;
      }
      if (u < odds.block + odds.delay) {
        const d = 1 + Math.floor(rng.float() * 3);
        site.ws3.delayedQ += d;
        site.stageEndDay = dayOfQuarter(s.time.startDate, q + d);
        ctx.log('company', `${site.name}: permits delayed ${d} quarter${d > 1 ? 's' : ''} by local opposition.`);
        return;
      }
    }
    const powerQ = Math.round(tri(rng.float(), p.powerQ[0], p.powerQ[1], p.powerQ[2]));
    const credit = site.ws3.queuedDay !== undefined && p.usesGridPool ? Math.max(0, Math.floor((s.time.day - site.ws3.queuedDay) / 91)) : 0;
    const extra = Math.max(0, powerQ - p.overlapQ - credit);
    if (extra > 0) {
      site.stage = 'power';
      site.stageEndDay = dayOfQuarter(s.time.startDate, q + extra);
    } else if (p.usesGridPool) {
      site.stage = 'power';
      site.stageEndDay = s.time.day; // needs a grid-pool slot this quarter
    } else enterBuilding(s, ctx, site, q);
  }
  if (site.stage === 'power' && site.stageEndDay <= s.time.day) {
    if (p.usesGridPool) {
      const gw = site.mw / 1000;
      const pw = s.power.ws3;
      if (pw.poolLeftGW + 1e-9 < gw) {
        site.stageEndDay = dayOfQuarter(s.time.startDate, q + 1); // pool exhausted: slip one quarter [R15]
        site.ws3.delayedQ += 1;
        return;
      }
      pw.poolLeftGW -= gw;
      s.power.queue = s.power.queue.filter((x) => x.siteId !== site.id);
    }
    enterBuilding(s, ctx, site, q);
    return;
  }
  if (site.stage === 'building') {
    const quartersLeft = Math.max(1, Math.round((site.stageEndDay - s.time.day) / 91));
    if (site.stageEndDay <= s.time.day) {
      payCapex(s, ctx, site, site.capex - site.capexPaid);
      site.stage = 'live';
      site.ws3.liveDay = s.time.day;
      ctx.log('company', `${site.name} is live: ${(site.mw / 1000).toFixed(1)} GW.`);
      if (site.spvFunded > 0) {
        const funded = site.capex * site.spvFunded;
        const t = site.ws3.financedBy === 'Keystone Capital' ? DEAL_TERMS.spv : { leaseRate: DEAL_TERMS.megaJV.leaseRate, rvgShare: 0, years: 6 };
        addLedger(s, { id: `L-spv-${site.id}`, payee: site.ws3.financedBy ?? 'SPV', kind: 'spvRVG', perQuarter: (funded * t.leaseRate) / 4, endDay: s.time.day + t.years * 365, cancellableNoticeQ: null, penalty: funded * t.rvgShare });
      }
    } else payCapex(s, ctx, site, (site.capex - site.capexPaid) / (quartersLeft + 0));
  }
}

/** Install installable inventory into live sites with free MW (1-quarter install lag, R15 §1.3). */
export function installInventory(s: GameStateV2): number {
  const inv = s.player.finance.ws3.inventory;
  if (inv.ready <= 0) return 0;
  let put = 0;
  for (const site of s.player.sites) {
    if (site.stage !== 'live' || inv.ready <= 0) continue;
    const free = siteCapacityH(s, site.mw) - site.installed;
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

/** Idle chips (delivered, no MW): UI "idle: no power". */
export const idleChips = (s: GameStateV2) => s.player.finance.ws3.inventory.ready + s.player.finance.ws3.inventory.transit;

/** sitesQ (410, quarterly): grid pool, kW efficiency, permitting/power/build stages and rolls, capex, installs. */
export const sitesQSystem: EngineSystem = {
  id: 'sitesQ', owner: 'WS3', cadence: 'quarterly', order: 410,
  run(s, ctx) {
    ensureWs3(s);
    const q = qOf(s);
    const pw = s.power;
    if (q > 0) {
      pw.kWPerH100e *= 0.944; // 1.26×/yr efficiency: 0.93 → 0.70 at Q4 2026 [R15, AI27]
      pw.poolGWPerQ *= Math.pow(1.25, 0.25); // US large-load pool ×1.25/yr [R15]
      s.market.ws3.leasePoolGW = LEASE.poolGWPerQ * Math.pow(LEASE.poolGrowth, q / 4);
    }
    // Labs get ~35% of new large-load grid capacity; hyperscalers not modelled as labs take the rest [D].
    pw.ws3.poolLeftGW = 0.35 * pw.poolGWPerQ;
    const queued = pw.queue.reduce((a, x) => a + x.gw, 0);
    pw.capacityPrice = Math.max(0, Math.min(0.15, 0.05 + 0.05 * (queued / Math.max(0.1, pw.poolGWPerQ) - 1))); // κ 0–15% [R15]
    for (const site of s.player.sites) if (site.stage !== 'live' && site.stage !== 'blocked') stepSite(s, ctx, site, q);
    installInventory(s);
  },
};
