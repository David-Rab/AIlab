// MK-4 check: buyer groups per sector × region (src/data/v2/market.ts) against design/MARKET.md "Buyers (M2)".
import { SECTOR_IDS, REGIONS } from '../../../src/data/v2/sectors';
import { buyerGroups, LARGE_SHARE, VETTED_SHARE } from '../../../src/data/v2/market';
import type { SectorId } from '../../../src/engine/v2/types';

// MARKET.md table (US): [L_s, v_s]; GOV L_s is "—" there (null).
const TABLE: Record<SectorId, [number | null, number]> = {
  SOFT: [0.595, 0.15], OFFICE: [0.54, 0.20], FIN: [0.687, 0.70], LEGAL: [0.192, 0.25], MEDIA: [0.429, 0.05],
  SCI: [0.545, 0.35], HEALTH: [0.563, 0.55], EDU: [0.871, 0], GOV: [null, 1.0], MIL: [0.89, 1.0],
  MFG: [0.591, 0.20], LOG: [0.668, 0.40], ENGY: [0.26, 0.15], SERV: [0.467, 0.03],
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
      const [L, v] = TABLE[s];
      ok(VETTED_SHARE[s] === v && g.vetted === v, `${s} v ${VETTED_SHARE[s]} ≠ table ${v}`);
      if (L !== null) {
        ok(LARGE_SHARE[s] === L, `${s} L ${LARGE_SHARE[s]} ≠ table ${L}`);
        ok(Math.abs(g.large - Math.max(0, L - v)) < 1e-12, `${s} US large ${g.large} ≠ max(0, L − v)`);
      }
    }
  }
}
if (fails.length) { console.log('\nFAIL\n' + fails.join('\n')); process.exit(1); }
console.log('\nOK: all groups sum to 1, none negative; GOV/MIL vetted 1, EDU vetted 0; US matches MARKET.md');
