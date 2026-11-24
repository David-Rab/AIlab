// RD-P08 (DD-04, PRD-10): a sector adaptation is an OWNED adaptation of one product for one sector. It has two parts:
//  - a scaffold: engineering work on the sector's workflows and integrations (the systems its work runs in), built on
//    the build queue; it raises that product's coverage of the sector's tasks (worldfx/serving.ts offerOf, OfferOpts
//    `adapted`) and of nothing else;
//  - a certification in the sectors that have one (CERT_SECTORS): a timed process with its cost, started when the
//    scaffold is built and held by the product. Once done it lowers the sector's adoption friction for that product's
//    buyers only (worldfx/sectors.ts frictionOf, certifiedBuyerShare; DD-04, RF-P3). The scaffold acts from its build
//    on, certified or not.
// Rivals and China have no sector adaptations (RF-P2: rivals are simplified aggregates with no product strategy; the
// automatic rival rule is deleted). Everything about adaptations lives here; Products shows one row.
import { SECTOR_BY_ID, SECTOR_IDS } from '../../../data/v2/sectors';
import type { ActionDef, Adaptation, BuildItem, CostLine, Deployment, GameStateV2, SectorId, SystemCtx } from '../types';
import { buildWaitNew, queueBuild } from '../departments/build';
import { bookCash } from '../finance/ledger';
import { revenueReadout } from '../worldfx/revenue';
import { useShareOf } from '../worldfx/use';

/** Engineer team-weeks to build a sector scaffold [D] (the old sector pack's 4; one team for a month). */
export const ADAPT_TW = 4;
/** Coverage gain of a sector scaffold: the offer covers ×(1 + ADAPT_COVER) of the sector's tasks (capped at all of
 *  them), and its agent work with it [D stand-in: the size of a product tool's share (Computer use 0.15, RD-P07); the
 *  tasks that need the sector's own systems (records, filings, ledgers) are the ones a generic offer cannot do. CAL-P: no
 *  primary source measures this share; Eloundou et al. 2023's E2 (tasks needing software built on the LLM, which
 *  includes access to internal data) bounds it from above at 0.3-0.6 by sector (research/CAL-products-sources.md A1)]. */
export const ADAPT_COVER = 0.15;
/** Sectors with a certification for AI vendors [D: US federal FedRAMP (GOV, MIL: DoD impact levels), health data
 *  HITRUST (HEALTH; HIPAA itself has none: HHS "does not endorse or otherwise recognize private organizations'
 *  'certifications'"), SOC 2 and model-risk review (FIN)]. */
export const CERT_SECTORS: readonly SectorId[] = ['FIN', 'HEALTH', 'GOV', 'MIL'];
/** Certification time (days) after the scaffold is built, one constant for all four sectors. 240 [P, CAL-P]: OpenAI's
 *  ChatGPT Enterprise / API got FedRAMP 20x Moderate on 27 Apr 2026, about 8 months after the AI prioritisation opened
 *  (Aug 2025; fedramp.gov/ai, openai.com). Range 3-24 months: FedRAMP Rev5 "exceeding one year and at times
 *  approaching up to two years" (fedramp.gov, Sep 2025), 20x pilot about 3.5 months, a first SOC 2 Type II about 6-12
 *  months (research/CAL-products-sources.md C1). */
export const CERT_DAYS = 240;
/** Certification cost ($B), booked when certification starts. $4M [P, CAL-P]: GAO-24-106591: providers' FedRAMP
 *  costs "ranged from $300,000 to $3.7 million", plus the sponsoring agency's $69,000-400,000 (the top of both). The
 *  old $0.4B was 100x that; the engineering is the scaffold's build (ADAPT_TW), not this (research/CAL-products-sources.md C2). */
export const CERT_CASH = 0.004;
/** Friction cut a certification gives its product's buyers in the sector (US): R_s - 0.1 [D] (research/16 §1A.3
 *  "lab-side certification that reduces R_s by 0.1"; the old pack's sector-wide -0.1, now for its buyers only). */
export const CERT_FRICTION_CUT = 0.1;
export const needsCert = (sector: SectorId) => CERT_SECTORS.includes(sector);
/** Channels whose products can carry an adaptation (the sector products). */
const HOST_CHANNELS: readonly Deployment['channel'][] = ['enterprise', 'api'] /* MK-11: Agents was a host; Agents → API */;
export const canHost = (d: Deployment) => d.status !== 'withdrawn' && HOST_CHANNELS.includes(d.channel);

/** Whether an adaptation's certification is done on a day (false where the sector has none). */
export const certified = (a: Adaptation, day: number) => a.certDone !== undefined && a.certDone <= day;
/** Whether a product has an adaptation for a sector (the only reader of the scaffold in the player's offer): it acts
 *  once built, certified or not. */
export const adaptedHere = (_s: GameStateV2, d: Pick<Deployment, 'adaptations'>, sector: string) =>
  (d.adaptations ?? []).some((a) => a.sector === sector);
/** The part of the player's buyers in a sector who buy from a live product certified there: the sum of those
 *  products' parts of the player's hours (SectorMix.playerProdW). The sector's friction cut is this x the player's
 *  customer share x CERT_FRICTION_CUT (worldfx/sectors.ts). */
export function certifiedBuyerShare(s: GameStateV2, sector: SectorId, prodW: Record<string, number>): number {
  let x = 0;
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn' || !(d.adaptations ?? []).some((a) => a.sector === sector && certified(a, s.time.day))) continue;
    x += prodW[d.id] ?? 0;
  }
  return Math.min(1, x);
}
/** A queued adaptation build for a product and sector. */
export const pendingAdaptation = (s: GameStateV2, hostId: string, sector: string): BuildItem | undefined =>
  s.player.build.queue.find((it) => it.kind === 'adaptation' && it.ref === sector && it.host === hostId);
/** Adaptations being built for a product. */
export const adaptationsBuilding = (s: GameStateV2, hostId: string): BuildItem[] => s.player.build.queue.filter((it) => it.kind === 'adaptation' && it.host === hostId);

/** The adaptations a new launch on a channel takes over (a relaunch): those of the latest retired product on the
 *  channel (certification kept). Read-only (deploy moves them). */
export function relaunchAdaptations(s: GameStateV2, channel: Deployment['channel']): { from?: Deployment; adaptations: Adaptation[] } {
  const from = [...s.player.deployments].reverse().find((d) => d.channel === channel && d.status === 'withdrawn' && (d.adaptations ?? []).length > 0);
  return from ? { from, adaptations: from.adaptations.map((a) => ({ ...a })) } : { adaptations: [] };
}

/** Build completion (departments/build.ts): the scaffold goes on its product; certification starts where required,
 *  its cost booked now. With no live host the work is lost and the player is told. */
export function completeAdaptation(s: GameStateV2, ctx: SystemCtx, it: BuildItem) {
  const sector = it.ref as SectorId;
  const name = SECTOR_BY_ID[sector]?.name ?? sector;
  const host = s.player.deployments.find((d) => d.id === it.host && canHost(d));
  if (!host) {
    ctx.log('company', `The ${name} adaptation was built but its product is no longer live: the work is lost.`, 2);
    return;
  }
  if (host.adaptations.some((a) => a.sector === sector)) return;
  if (needsCert(sector)) {
    host.adaptations.push({ sector, certDone: ctx.day + CERT_DAYS });
    bookCash(s, ctx, -CERT_CASH, 'world', 'sector certification', name);
    ctx.log('company', `${name} adaptation built: it is live; certification started (${CERT_DAYS} days, $${CERT_CASH}B).`, 1, host.id);
  } else {
    host.adaptations.push({ sector });
    ctx.log('company', `${name} adaptation built: it is live.`, 1, host.id);
  }
}

// ───────────────────────────── the action ─────────────────────────────

type P = Record<string, number | string | boolean>;

function hostOf(s: GameStateV2, id?: string): Deployment | undefined {
  const deps = s.player.deployments.filter(canHost);
  if (id) return deps.find((d) => d.id === id);
  return deps.find((d) => d.channel === 'enterprise') ?? deps[0];
}
const taken = (s: GameStateV2, host: Deployment, sector: SectorId) => host.adaptations.some((a) => a.sector === sector) || !!pendingAdaptation(s, host.id, sector);
/** Default sector for a product: the largest US AI spend it has not adapted to yet. */
function defaultSector(s: GameStateV2, host: Deployment): SectorId | undefined {
  let best: SectorId | undefined;
  let bx = -1;
  for (const id of SECTOR_IDS) {
    if (taken(s, host, id)) continue;
    const st = s.world.sectors.US[id];
    const x = useShareOf(st, id) * st.E0 * SECTOR_BY_ID[id].wage;
    if (x > bx) {
      bx = x;
      best = id;
    }
  }
  return best;
}
function target(s: GameStateV2, p: P): { sector?: SectorId; host?: Deployment } {
  const host = hostOf(s, typeof p.deploymentId === 'string' ? p.deploymentId : undefined);
  const sector = (typeof p.sector === 'string' && (SECTOR_IDS as string[]).includes(p.sector) ? p.sector : host ? defaultSector(s, host) : undefined) as SectorId | undefined;
  return { sector, host };
}

/** The revenue a live adaptation adds ($B/yr), from the market itself: today's market with it live on its product
 *  against without, both with the sector's customers at the shares they move toward. */
export function adaptRevenueGain(s: GameStateV2, host: Deployment, sector: SectorId): number {
  const cust: NonNullable<GameStateV2['world']['fx']['cust']> = { US: {}, CN: {}, ROW: {} };
  for (const [r, row] of Object.entries(s.world.fx.cust ?? {}) as [keyof typeof cust, Record<string, Record<string, number>>][]) {
    const { [sector]: _drop, ...rest } = row;
    cust[r] = rest;
  }
  const base: GameStateV2 = { ...s, world: { ...s.world, fx: { ...s.world.fx, cust } } };
  const n: Deployment = { ...host, adaptations: [...host.adaptations.filter((a) => a.sector !== sector), { sector }] };
  const withA: GameStateV2 = { ...base, player: { ...base.player, deployments: s.player.deployments.map((d) => (d.id === host.id ? n : d)) } };
  return revenueReadout(withA).total - revenueReadout(base).total;
}

const adapt: ActionDef = {
  id: 'product.adapt', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Adapt to sector',
  available(s) {
    const h = hostOf(s);
    if (!h) return 'Needs a live Enterprise or API product';
    if (!defaultSector(s, h)) return 'This product is adapted to every sector';
    return true;
  },
  preview(s, p: P) {
    const { sector, host } = target(s, p);
    const wait = buildWaitNew(s, ADAPT_TW, 'adaptation');
    const costs: CostLine[] = [{ currency: 'staffTime', amount: -ADAPT_TW, target: `engineer team-weeks · scaffold built in ${Number.isFinite(wait) ? `${wait} d` : "never at today's engineering"}` }];
    const gains: CostLine[] = [];
    if (sector && host) {
      const cert = needsCert(sector);
      if (cert) costs.push({ currency: 'cash', amount: -CERT_CASH, target: `${SECTOR_BY_ID[sector].name} certification, ${CERT_DAYS} d after the scaffold: then this product's buyers there face ${CERT_FRICTION_CUT} less adoption friction` });
      const gain = Math.round(adaptRevenueGain(s, host, sector) * 100) / 100;
      const lag = Number.isFinite(wait) ? wait : 0;
      const line: CostLine = { currency: 'revenue', amount: gain, target: `${SECTOR_BY_ID[sector].name}, on this product only, once the scaffold is built and its customers have switched (today's market; certification's friction cut not included)`, ...(lag > 0 && Number.isFinite(wait) ? { lagDays: lag } : {}) };
      if (gain >= 0) gains.push(line);
      else costs.push(line);
    }
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p: P) {
    const { sector, host } = target(s, p);
    if (!sector || !host) return 'No product or sector to adapt';
    if (taken(s, host, sector)) return 'This product already has that adaptation';
    queueBuild(s, 'adaptation', sector, ADAPT_TW, { host: host.id });
    ctx.log('company', `Engineers start adapting the product to ${SECTOR_BY_ID[sector].name}${needsCert(sector) ? `, then ${CERT_DAYS} days of certification` : ''}.`, 1, host.id);
  },
};
export const ADAPT_ACTIONS: ActionDef[] = [adapt];
