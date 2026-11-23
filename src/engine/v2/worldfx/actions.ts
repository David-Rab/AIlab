// Player actions in the World sphere (sector products, transition fund, moonshots). Owner: WS5.
// Every preview shows what apply() does (V2-SPEC §2.7 preview truth).
import { SECTOR_BY_ID, SECTOR_IDS } from '../../../data/v2/sectors';
import { TECH_BY_ID, WORLD_TECHS } from '../../../data/v2/techs';
import type { ActionDef, CostLine, Deployment, GameStateV2, SectorId, SystemCtx } from '../types';
import { paidDeployments, worldMix } from './mix';
import { moonshotH100e } from './revenue';
import { gSci, mSci, scienceRate, techBlocker } from './techtree';
import { domainScaleGs } from '../models/capability';
import { internalVersion } from '../models/labs';
import { useShareOf } from './use';
import { revenueReadout } from './revenue';
import { bookCash } from '../finance/ledger';
import { buildWaitNew, pendingPack, queueBuild, SECTOR_CERT_DAYS, SECTOR_PACK_CASH, SECTOR_PACK_TW } from '../departments/build';
import { sectorCertDay } from '../models/products';

/** Sector product: certification time and cash [D] (research/16 §1A.3 "costs months and money"). */
export const PRODUCT = { days: SECTOR_CERT_DAYS, cash: SECTOR_PACK_CASH };

type P = Record<string, number | string | boolean>;

/** Deployments that can carry a sector product (enterprise first, then API/agents). */
function productHost(s: GameStateV2, id?: string): Deployment | undefined {
  const deps = paidDeployments(s).filter((d) => d.channel === 'enterprise' || d.channel === 'api' || d.channel === 'agents');
  if (id) return deps.find((d) => d.id === id);
  return deps.find((d) => d.channel === 'enterprise') ?? deps[0];
}

/** Default sector: largest US AI spend where the player has no product yet. */
function defaultSector(s: GameStateV2): SectorId | undefined {
  let best: SectorId | undefined;
  let bx = -1;
  for (const id of SECTOR_IDS) {
    if (sectorCertDay(s, id) !== undefined || pendingPack(s, id)) continue;
    const st = s.world.sectors.US[id];
    const x = useShareOf(st, id) * st.E0 * SECTOR_BY_ID[id].wage; // hours of AI use × wage (A2a)
    if (x > bx) {
      bx = x;
      best = id;
    }
  }
  return best;
}

/** RD-B20: the revenue a certified pack adds ($B/yr), from the market itself: today's market with the pack on its host
 *  (certified today: its fit bonus, Enterprise's ×3 sector weight) against without, both with the sector's customers
 *  at the shares they move toward (the customer stock catches up over CUSTOMER_TAU.sector, about eight months). */
export function packRevenueGain(s: GameStateV2, host: Deployment, sector: SectorId): number {
  const cust: NonNullable<GameStateV2['world']['fx']['cust']> = { US: {}, CN: {}, ROW: {} };
  for (const [r, row] of Object.entries(s.world.fx.cust ?? {}) as [keyof typeof cust, Record<string, Record<string, number>>][]) {
    const { [sector]: _drop, ...rest } = row;
    cust[r] = rest;
  }
  const base: GameStateV2 = { ...s, world: { ...s.world, fx: { ...s.world.fx, cust } } };
  const n: Deployment = { ...host, packs: [...host.packs.filter((x) => x.sector !== sector), { sector, certDay: s.time.day }] };
  const withPack: GameStateV2 = { ...base, player: { ...base.player, deployments: s.player.deployments.map((d) => (d.id === host.id ? n : d)) } };
  return revenueReadout(withPack).total - revenueReadout(base).total;
}

/** Days until a sector pack queued now is built. */
function packWait(s: GameStateV2): string {
  const d = buildWaitNew(s, SECTOR_PACK_TW, 'sectorPack');
  return Number.isFinite(d) ? `${d} d` : "never at today's engineering";
}

/** The sector and host a pack action with these params acts on (preview and apply read the same). */
function packTarget(s: GameStateV2, p: P): { sector?: SectorId; host?: Deployment } {
  const sector = (typeof p.sector === 'string' && (SECTOR_IDS as string[]).includes(p.sector) ? p.sector : defaultSector(s)) as SectorId | undefined;
  return { sector, host: productHost(s, typeof p.deploymentId === 'string' ? p.deploymentId : undefined) };
}

const sectorProduct: ActionDef = {
  id: 'wfx.sectorProduct', verb: 'launch', system: 'products',
  sphere: 'world',
  owner: 'WS5',
  title: 'Sector product',
  available(s) {
    if (!s.player.features.includes('sectorPacks')) return 'Needs the Sector packs feature (build it on Products)';
    if (!productHost(s)) return 'Needs a live enterprise, API or agents deployment';
    if (!defaultSector(s)) return 'Every sector already has a product';
    return true;
  },
  preview(s, p: P) {
    const { sector, host } = packTarget(s, p);
    const costs: CostLine[] = [
      { currency: 'cash', amount: -PRODUCT.cash },
      // J2 P1: engineers build the pack first, then certification starts.
      { currency: 'staffTime', amount: -SECTOR_PACK_TW, target: `engineer team-weeks · built in ${packWait(s)}` },
    ];
    const gains: CostLine[] = [];
    if (sector && host) {
      const wait = buildWaitNew(s, SECTOR_PACK_TW, 'sectorPack');
      const gain = Math.round(packRevenueGain(s, host, sector) * 100) / 100;
      const line: CostLine = { currency: 'revenue', amount: gain, target: `${SECTOR_BY_ID[sector].name}, once certified and its customers have switched (today's market)`, ...(Number.isFinite(wait) ? { lagDays: wait + PRODUCT.days } : {}) };
      if (gain >= 0) gains.push(line);
      else costs.push(line);
    }
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p: P) {
    const { sector, host } = packTarget(s, p);
    if (!sector || !host) return;
    if (sectorCertDay(s, sector) !== undefined || pendingPack(s, sector)) throw new Error('That sector already has a product');
    // J2 P1: the engineers build the pack (build queue); certification (PRODUCT.days) starts when it is built.
    const wait = packWait(s);
    queueBuild(s, 'sectorPack', sector, SECTOR_PACK_TW, { host: host.id });
    bookCash(s, ctx, -PRODUCT.cash, 'world', 'sector product', SECTOR_BY_ID[sector].name);
    ctx.log('company', `Engineers start building the ${SECTOR_BY_ID[sector].name} pack (${wait}, then ${PRODUCT.days} days of certification).`);
  },
};

/** Transition fund: $B/yr to retraining and transition support (research/16 §1A.2 step 9: each $10B/yr adds +0.1
 *  Retrain, cap +0.5; research/07 JobAnxiety relief). The single implementation of the fund: WS4 events call
 *  `setTransitionFund`; WS3's payroll system charges it monthly through the finance ledger. */
const transitionFund: ActionDef = {
  id: 'wfx.transitionFund', verb: 'deal', system: 'world',
  sphere: 'world',
  owner: 'WS5',
  title: 'Transition fund',
  available(s) {
    return s.player.finance.cash > 1 ? true : 'Not enough cash';
  },
  preview(s, p: P) {
    const cur = s.player.policies.transitionFund;
    const amount = typeof p.amount === 'number' ? Math.max(0, p.amount) : cur + 5;
    const d = amount - cur;
    if (d >= 0) {
      return {
        costs: [{ currency: 'cash', amount: -d }],
        gains: [
          { currency: 'approval', amount: Math.round(Math.min(5, d * 0.4) * 10) / 10, lagDays: 90 },
          { currency: 'trust', amount: Math.round(Math.min(8, d * 0.6) * 10) / 10, target: 'bloc:labor' },
        ],
        exposure: [],
      };
    }
    return {
      costs: [
        { currency: 'approval', amount: Math.round(Math.max(-5, d * 0.4) * 10) / 10 },
        { currency: 'trust', amount: Math.round(Math.max(-12, d * 1.0) * 10) / 10, target: 'bloc:labor' },
      ],
      gains: [{ currency: 'cash', amount: -d }],
      exposure: [],
    };
  },
  apply(s, ctx, p: P) {
    const cur = s.player.policies.transitionFund;
    setTransitionFund(s, ctx, typeof p.amount === 'number' ? p.amount : cur + 5);
  },
};

/** Set the transition fund ($B/yr, 0–100) with its one-off public effects. Used by wfx.transitionFund and events. */
export function setTransitionFund(s: GameStateV2, ctx: SystemCtx, perYear: number): void {
  {
    const cur = s.player.policies.transitionFund;
    const amount = Math.max(0, Math.min(100, perYear));
    const d = amount - cur;
    s.player.policies.transitionFund = amount;
    if (d > 0) {
      ctx.bump('pub.approval', Math.min(5, d * 0.4), 'transition fund');
      ctx.bump('pub.jobAnxiety', -Math.min(6, d * 0.5), 'transition fund');
      ctx.bump('trust:bloc:labor', Math.min(8, d * 0.6), 'transition fund');
    } else if (d < 0) {
      ctx.bump('pub.approval', Math.max(-5, d * 0.4), 'transition fund cut');
      ctx.bump('trust:bloc:labor', Math.max(-12, d), 'transition fund cut');
    }
    ctx.log('company', `Transition fund set to ${amount.toFixed(0)}B/yr.`);
  }
}

/** Default moonshot target: a researchable, non-risk technology with benefits. */
function defaultTech(s: GameStateV2): string | undefined {
  const best = worldMix(s).bestPublic;
  const iv = internalVersion(s);
  const lv = { ...best };
  // RD-P04b: domain G (OOM) of the best public model and the internal model, as the tech gates read.
  const ivg = iv ? domainScaleGs(s.hidden.timeline, iv) : undefined;
  if (ivg) for (const k of Object.keys(lv) as (keyof typeof lv)[]) lv[k] = Math.max(lv[k], ivg[k]);
  for (const t of WORLD_TECHS) {
    const st = s.world.techs[t.id];
    if (!st || st.discoveredDay !== undefined || t.risk) continue;
    if (!techBlocker(s, t, lv)) return t.id;
  }
  return undefined;
}

/** Science moonshot: assign a share of compute to one world technology (research/16 §3.1). Taken from the serving
 *  pool first, so it is a revenue sink; benefits and approval on discovery; dual-use exposure for risk techs. */
const moonshot: ActionDef = {
  id: 'wfx.moonshot', verb: 'deal', system: 'world',
  sphere: 'world',
  owner: 'WS5',
  title: 'Moonshot',
  available(s) {
    if (Object.values(s.world.techs).some((t) => t.playerProject)) return true;
    return defaultTech(s) ? true : 'No technology is researchable yet';
  },
  preview(s, p: P) {
    const techId = typeof p.tech === 'string' && TECH_BY_ID[p.tech] ? p.tech : defaultTech(s) ?? Object.keys(s.world.techs).find((k) => s.world.techs[k].playerProject) ?? 'W03';
    const t = TECH_BY_ID[techId];
    const cur = s.world.techs[techId]?.playerProject?.computeShare ?? 0;
    const share = typeof p.share === 'number' ? Math.max(0, Math.min(0.3, p.share)) : cur > 0 ? 0 : 0.03;
    const dShare = share - cur;
    // Revenue at stake: the serving capacity removed (or returned), valued at the average capacity rate.
    const rd = revenueReadout(s);
    let h = 0;
    for (const x of rd.deps) h += x.servingH100e;
    const perH = h > 0 ? rd.capacity / h : 0;
    const dH = s.player.computeOnline * dShare;
    const util = rd.capacity > 0 ? Math.min(1, rd.total / rd.capacity) : 0;
    const revLoss = Math.round(dH * perH * Math.max(0.3, util) * 100) / 100;
    const v = internalVersion(s);
    const sPlayer = v ? mSci(s.hidden.timeline, gSci(domainScaleGs(s.hidden.timeline, v))) * Math.abs(dShare) * 10 : 0;
    const { S } = scienceRate(s);
    const yearsSaved = t ? Math.max(0, (1 - (s.world.techs[techId]?.prog ?? 0)) * t.effort * (1 / S - 1 / (S + sPlayer))) : 0;
    const benefit = t?.effects.benefit ?? 1;
    if (dShare >= 0) {
      const exposure: CostLine[] = t?.risk ? [{ currency: 'scrutiny', amount: 5, probability: 0.5, lagDays: 180 }, { currency: 'chinaTension', amount: 3, probability: 0.3 }] : [];
      return {
        costs: [{ currency: 'compute', amount: -Math.round(dH) }, { currency: 'revenue', amount: -revLoss }],
        gains: [{ currency: 'approval', amount: Math.round(benefit * 0.8 * 10) / 10, target: t?.name, lagDays: Math.round(yearsSaved * 365) }, { currency: 'credibility', amount: 2 }],
        exposure,
      };
    }
    return {
      costs: [{ currency: 'approval', amount: -Math.round(benefit * 0.5 * 10) / 10, target: t?.name }],
      gains: [{ currency: 'compute', amount: Math.round(-dH) }, { currency: 'revenue', amount: revLoss }],
      exposure: [],
    };
  },
  apply(s, ctx, p: P) {
    const techId = typeof p.tech === 'string' && TECH_BY_ID[p.tech] ? p.tech : defaultTech(s);
    if (!techId) return;
    const st = s.world.techs[techId];
    const cur = st.playerProject?.computeShare ?? 0;
    const share = typeof p.share === 'number' ? Math.max(0, Math.min(0.3, p.share)) : cur > 0 ? 0 : 0.03;
    if (share <= 0) {
      delete st.playerProject;
      ctx.log('company', `Moonshot on ${TECH_BY_ID[techId].name} wound down.`);
      return;
    }
    // Cap total moonshot compute at the serving pool.
    const others = moonshotH100e(s) - s.player.computeOnline * cur;
    const room = Math.max(0, s.player.computeOnline * s.player.split.serving - others) / Math.max(1, s.player.computeOnline);
    st.playerProject = { computeShare: Math.min(share, room) };
    const blocked = techBlocker(s, TECH_BY_ID[techId], worldMix(s).bestPublic);
    ctx.log('company', `Moonshot on ${TECH_BY_ID[techId].name}: ${(st.playerProject.computeShare * 100).toFixed(1)}% of compute${blocked ? ` (gate: ${blocked}, needs our internal model)` : ''}.`);
  },
};

export const WORLD_ACTIONS: ActionDef[] = [sectorProduct, transitionFund, moonshot];
