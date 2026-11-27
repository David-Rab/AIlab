// RD-P10 targeted check: misuse exposure comes from served usage per model (Deployment.servedBy), never servingShare.
// Zero usage → zero exposure; exposure scales with usage; a lineup model with usage is its own site with its own
// exposure; a servingShare change alone changes nothing.
// Run alone: npx tsx scripts/v2/_p10/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { forEachIncidentSite, misuseHazards, misuseReach, usageOf } from '../../../src/engine/v2/safety/incidents';
import { versionById } from '../../../src/engine/v2/safety/common';
import { MISUSE_TOKENS_REF } from '../../../src/data/v2/danger';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', baseline: 'classic', tutorial: false }));
const fill = (g: GameStateV2) => {
  const rd = revenueReadout(g);
  for (const x of rd.deps) {
    const d = g.player.deployments.find((y) => y.id === x.id)!;
    d.servedBy = x.servedBy;
    d.servedTokensDay = Object.values(x.servedBy).reduce((a, b) => a + b, 0);
  }
  return rd;
};
const rd0 = fill(s);
let T = 0;
for (const d of s.player.deployments) T += d.servedTokensDay ?? 0;
console.log(`day-0 served tokens/day: ${T.toExponential(2)} (MISUSE_TOKENS_REF ${MISUSE_TOKENS_REF.toExponential(0)}); per product:`,
  s.player.deployments.filter((d) => d.servedBy).map((d) => `${d.id} ${d.channel} ${Object.entries(d.servedBy!).map(([k, v]) => `${k}:${v.toExponential(1)}`).join(' ')} share ${d.servingShare.toFixed(2)}`).join(' | '));
const H = (g: GameStateV2, d: Deployment, id: string) => misuseHazards(g, versionById(g, id)!, d).reduce((a, r) => a + r.h, 0);
const sites = (g: GameStateV2) => { const out: string[] = []; forEachIncidentSite(g, (d, v, u) => out.push(`${d.id}|${v.id}|${u.toFixed(6)}`)); return out; };

// Pick a product whose usage includes a lineup model.
const prod = s.player.deployments.find((d) => d.channel !== 'internal' && d.channel !== 'open' && Object.keys(d.servedBy ?? {}).some((k) => k !== d.versionId && (d.servedBy![k] ?? 0) > 0));
check(!!prod, 'a start product serves a lineup model', prod ? `${prod.id} ${prod.channel}` : 'none');
if (prod) {
  const main = prod.versionId;
  const low = Object.keys(prod.servedBy!).find((k) => k !== main && prod.servedBy![k] > 0)!;

  // 1. Zero usage → zero exposure (and no incident site).
  const z = structuredClone(s);
  const dz = z.player.deployments.find((d) => d.id === prod.id)!;
  dz.servedBy = {};
  check(H(z, dz, main) === 0 && H(z, dz, low) === 0 && misuseReach(dz, { id: main }) === 0 && usageOf(z, dz) === 0, 'zero usage → zero misuse exposure');
  check(!sites(z).some((x) => x.startsWith(`${prod.id}|`)), 'zero usage → no incident site for the product');

  // 2. Exposure scales with usage.
  const u2 = structuredClone(s);
  const d2 = u2.player.deployments.find((d) => d.id === prod.id)!;
  d2.servedBy = { ...d2.servedBy!, [main]: d2.servedBy![main] * 2 };
  const h1 = H(s, prod, main), h2 = H(u2, d2, main);
  check(h1 > 0 && Math.abs(h2 / h1 - 2) < 1e-9, 'misuse exposure ∝ the model\'s usage', `h ${h1.toExponential(3)} → ${h2.toExponential(3)}`);

  // 3. A lineup model with usage has its own exposure and its own site.
  const hl = H(s, prod, low);
  const vl = versionById(s, low)!, vm = versionById(s, main)!;
  const site = sites(s).find((x) => x.startsWith(`${prod.id}|${low}|`));
  check(hl > 0 && !!site, 'lineup model has its own misuse exposure and incident site', `${low} h ${hl.toExponential(3)} (main ${h1.toExponential(3)}), CYBER L ${vl.domains.CYBER.toFixed(2)} vs main ${vm.domains.CYBER.toFixed(2)}, ${site}`);
  const c = structuredClone(s);
  const dc = c.player.deployments.find((d) => d.id === prod.id)!;
  versionById(c, low)!.domains.CYBER = 9; // the lineup model alone gains the misuse-relevant level
  const hl2 = H(c, dc, low), hm2 = H(c, dc, main);
  check(hl2 > hl && hm2 === h1, 'lineup exposure reads its own (true) capability, the main model\'s stays', `lineup h ${hl.toExponential(3)} → ${hl2.toExponential(3)}, main ${hm2.toExponential(3)}`);

  // 4. servingShare alone changes nothing.
  const ss = structuredClone(s);
  const ds = ss.player.deployments.find((d) => d.id === prod.id)!;
  ds.servingShare = Math.min(1, prod.servingShare * 3 + 0.2);
  check(H(ss, ds, main) === h1 && H(ss, ds, low) === hl && sites(ss).join() === sites(s).join(), 'servingShare change alone leaves exposure and sites unchanged');
  if (ss.player.policies.servingAuto) {
    const rd1 = fill(ss);
    const same = rd1.deps.every((x) => JSON.stringify(x.servedBy) === JSON.stringify(rd0.deps.find((y) => y.id === x.id)!.servedBy));
    check(same, 'Auto serving: servingShare is no input to usage (servedBy identical after recompute)');
  }
}
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
