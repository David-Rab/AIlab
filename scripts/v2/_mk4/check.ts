// MK-4 check: buyer groups per sector × region (src/data/v2/market.ts) against design/MARKET.md "Buyers (M2)".
import { SECTOR_IDS, REGIONS } from '../../../src/data/v2/sectors';
import { buyerGroups, LARGE_SHARE, PUBLIC_SHARE, REGULATED_FRACTION } from '../../../src/data/v2/market';
import type { SectorId } from '../../../src/engine/v2/types';

// MARKET.md table (US): [L_s, p_s, r_s, small, large, vetted] (GOV L_s "—" there: null).
const TABLE: Record<SectorId, [number | null, number, number, number, number, number]> = {
  SOFT: [0.595, 0, 0.15, 0.405, 0.506, 0.089], OFFICE: [0.54, 0, 0.15, 0.46, 0.459, 0.081],
  FIN: [0.687, 0, 0.5, 0.313, 0.344, 0.344], LEGAL: [0.192, 0, 0.25, 0.808, 0.144, 0.048],
  MEDIA: [0.429, 0, 0.05, 0.571, 0.408, 0.021], SCI: [0.545, 0, 0.35, 0.455, 0.354, 0.191],
  HEALTH: [0.563, 0.219, 0.5, 0.341, 0.220, 0.439], EDU: [0.871, 0, 0, 0.129, 0.871, 0],
  GOV: [null, 1, 0, 0, 0, 1], MIL: [0.89, 1, 0, 0, 0, 1], MFG: [0.591, 0, 0.2, 0.409, 0.473, 0.118],
  LOG: [0.668, 0, 0.25, 0.332, 0.501, 0.167], ENGY: [0.26, 0, 0.5, 0.74, 0.13, 0.13],
  SERV: [0.467, 0, 0.03, 0.533, 0.453, 0.014],
};
const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (!c) fails.push(m); };
const f = (x: number) => x.toFixed(3);
for (const r of REGIONS) {
  console.log(`\n${r}       small  large  vetted`);
  for (const s of SECTOR_IDS) {
    const g = buyerGroups(s, r);
    console.log(`${s.padEnd(8)} ${f(g.small)}  ${f(g.large)}  ${f(g.vetted)}`);
    ok(Math.abs(g.small + g.large + g.vetted - 1) < 1e-12, `${s}/${r} sum ${g.small + g.large + g.vetted}`);
    ok(g.small >= 0 && g.large >= 0 && g.vetted >= 0, `${s}/${r} negative`);
    if (s === 'GOV' || s === 'MIL') ok(g.vetted === 1, `${s}/${r} vetted ${g.vetted}`);
    if (s === 'EDU') ok(g.vetted === 0, `EDU/${r} vetted ${g.vetted}`);
    if (r === 'US') {
      const [L, p, rr, sm, lg, vt] = TABLE[s];
      if (L !== null) ok(LARGE_SHARE[s] === L, `${s} L ${LARGE_SHARE[s]} ≠ table ${L}`);
      ok(PUBLIC_SHARE[s] === p, `${s} p ${PUBLIC_SHARE[s]} ≠ table ${p}`);
      ok(REGULATED_FRACTION[s] === rr, `${s} r ${REGULATED_FRACTION[s]} ≠ table ${rr}`);
      ok(f(g.small) === f(sm) && f(g.large) === f(lg) && f(g.vetted) === f(vt), `${s} US groups ≠ table ${sm}/${lg}/${vt}`);
    }
  }
}
if (fails.length) { console.log('\nFAIL\n' + fails.join('\n')); process.exit(1); }
console.log('\nOK: all groups sum to 1, none negative; GOV/MIL vetted 1, EDU vetted 0; US matches MARKET.md');
