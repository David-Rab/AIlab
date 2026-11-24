// MK-11 (design/MARKET.md M14): sector certification follows the harness. A product is certified in a sector that has
// a certification (data/v2/tools.ts CERT_SECTORS: FIN, HEALTH, GOV, MIL) when it carries a harness covering that sector
// (built lab-wide, switched on for the product), CERT_DAYS after it first carried one, at CERT_CASH booked when the
// certification starts. Once done it lowers the sector's adoption friction for that product's buyers only
// (worldfx/sectors.ts frictionOf, certifiedBuyerShare; DD-04, RF-P3). The record stays on the product (Deployment.certs)
// when the harness is switched off, but acts only while one is on; a relaunch on the channel takes the records over.
// Replaces the sector adaptations (RD-P08, models/adaptations.ts, deleted): their coverage gain is the harness's ΔG.
import { PRODUCT_TOOLS, CERT_CASH, CERT_DAYS, needsCert, toolCertSectors, type ProductToolDef } from '../../../data/v2/tools';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import type { Certification, Deployment, GameStateV2, SectorId, SystemCtx } from '../types';
import { bookCash } from '../finance/ledger';
import { activeFeatures } from './products';

/** The harnesses (built and switched on) of a product that cover a sector with a certification. */
export function certHarnesses(s: GameStateV2, d: Deployment, sector: SectorId): ProductToolDef[] {
  return activeFeatures(s, d).filter((t) => toolCertSectors(t).includes(sector));
}
/** The harnesses a product of channel `ch` could carry that certify it in `sector` (the Products screen's hint). */
export const harnessesCertifying = (sector: SectorId, ch: Deployment['channel']): ProductToolDef[] =>
  PRODUCT_TOOLS.filter((t) => toolCertSectors(t).includes(sector) && (t.products as string[]).includes(ch));
/** Whether a certification record is done on a day. */
export const certDoneBy = (c: Certification, day: number) => c.certDone <= day;
/** Whether a product is certified in a sector today: a done record and a harness on that covers the sector. */
export function certifiedHere(s: GameStateV2, d: Deployment, sector: SectorId): boolean {
  const c = (d.certs ?? []).find((x) => x.sector === sector);
  return !!c && certDoneBy(c, s.time.day) && certHarnesses(s, d, sector).length > 0;
}
/** The part of the player's buyers in a sector who buy from a live product certified there: the sum of those
 *  products' parts of the player's hours (SectorMix.playerProdW). The sector's friction cut is this × the player's
 *  customer share × CERT_FRICTION_CUT (worldfx/sectors.ts). */
export function certifiedBuyerShare(s: GameStateV2, sector: SectorId, prodW: Record<string, number>): number {
  let x = 0;
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn' || !certifiedHere(s, d, sector)) continue;
    x += prodW[d.id] ?? 0;
  }
  return Math.min(1, x);
}
/** The certifications a new launch on a channel takes over (a relaunch): those of the latest retired product on the
 *  channel. Read-only (deploy moves them). */
export function relaunchCerts(s: GameStateV2, channel: Deployment['channel']): { from?: Deployment; certs: Certification[] } {
  const from = [...s.player.deployments].reverse().find((d) => d.channel === channel && d.status === 'withdrawn' && (d.certs ?? []).length > 0);
  return from ? { from, certs: from.certs.map((c) => ({ ...c })) } : { certs: [] };
}

/** Daily (build system): a live product that carries a harness covering a certification sector it has no record for
 *  starts that certification today (CERT_DAYS, CERT_CASH booked now). */
export function certStep(s: GameStateV2, ctx: SystemCtx) {
  for (const d of s.player.deployments) {
    if (d.kind !== 'product' || d.status === 'withdrawn' || !d.features.length) continue;
    for (const t of activeFeatures(s, d)) {
      for (const sector of toolCertSectors(t)) {
        if (!needsCert(sector) || (d.certs ??= []).some((c) => c.sector === sector)) continue;
        d.certs.push({ sector, certDone: ctx.day + CERT_DAYS });
        const name = SECTOR_BY_ID[sector]?.name ?? sector;
        bookCash(s, ctx, -CERT_CASH, 'world', 'sector certification', name);
        ctx.log('company', `${t.name} on this product: ${name} certification started (${CERT_DAYS} days, $${CERT_CASH}B).`, 1, d.id);
      }
    }
  }
}
