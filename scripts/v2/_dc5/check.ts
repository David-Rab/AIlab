// DC-5 check: start sites and start ledgers on rent / grid / gas (DC-TASKS [D-10], [D-12]).
// Run: npx tsx scripts/v2/_dc5/check.ts
import { defaultSetupV2, newGame, worldWaitQ } from '../../../src/engine/v2';
import { decimalYear, quarterIndex, dateOfDay } from '../../../src/engine/v2/core/time';
import { siteLiveQ } from '../../../src/engine/v2/compute/forecast';
import { rateGWPerYear } from '../../../src/engine/v2/compute/waits';
import { SOURCES, SITE_MIN_MW, RENT } from '../../../src/data/v2/deals';
import type { StartType } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const near = (got: number, want: number, what: string, tol = 1e-9) => check(Math.abs(got - want) <= tol, what, `${+got.toFixed(4)}, want ${+want.toFixed(4)}`);

for (const start of ['leader', 'challenger', 'bigtech', 'spinout'] as StartType[]) {
  const s = newGame(defaultSetupV2({ seed: 1, start }));
  const t0 = s.time.startDate;
  console.log(`-- ${start}`);
  for (const x of s.player.sites) {
    const lq = siteLiveQ(s, x);
    const liveDate = x.stage === 'live' ? new Date(dateOfDay(t0, x.ws3.liveDay ?? 0)).toISOString().slice(0, 10) : lq ? `q${lq.q}` : '-';
    console.log(`   ${x.id} ${x.name}: ${x.path} ${x.mw} MW ${x.stage}, live ${liveDate} (q ${lq?.q}), capex ${x.capex} paid ${x.capexPaid}`);
    check(['rent', 'grid', 'gas'].includes(x.path), `${x.id} source`, x.path);
    check(x.mw >= SITE_MIN_MW && x.mw <= SOURCES[x.path].maxMW, `${x.id} size within caps`, `${x.mw} MW, max ${SOURCES[x.path].maxMW}`);
    if (x.stage === 'live') check(x.ws3.liveDay !== undefined && x.ws3.liveDay <= 0, `${x.id} live has liveDay`);
  }
  const rents = s.player.finance.ledger.filter(l => l.payee === 'Data-centre rent');
  const rentMW = s.player.sites.filter(x => x.path === 'rent').reduce((a, x) => a + x.mw, 0);
  near(rents.reduce((a, l) => a + l.perQuarter, 0), (rentMW / 1000) * RENT.perGWYear / 4, `${start} rent ledger = rent MW x price`);
  check(!s.player.finance.ledger.some(l => /lease-S|Colocation/.test(l.id + l.payee)), `${start} no old lease entries`);
  if (start === 'leader') {
    const [s1, s2, s3, s4] = s.player.sites;
    check(s1.path === 'rent' && s1.mw === 300 && s1.ws3.powerQ === 1, 'S1 rent 300');
    near(s2.capex, 4.26, 'S2 capex'); near(s3.capex, 12, 'S3 capex'); near(s3.capexPaid, 6, 'S3 paid');
    check(s3.path === 'gas' && s3.stage === 'building', 'S3 gas building');
    check(s4.path === 'grid' && s4.mw === 1000 && s4.stage === 'power' && s4.ws3.rolled && s4.ws3.powerQ === 17 && s4.ws3.buildQ === 8, 'S4 Red River 1 GW grid power stage, rolled, 17 q');
    near(s4.capexPaid, 0.05 * s4.capex, 'S4 paid 5%');
    const lq = siteLiveQ(s, s4)!;
    const idx = (2029 - 2025) * 4 + (4 - 3) ; // Q4 29 relative to Q3 25 = 17
    check(lq.q === idx && lq.firm, 'Red River live Q4 29', `q ${lq.q}, want ${idx}`);
    const y = decimalYear(s);
    near(worldWaitQ(s, 'grid'), 19 + 4 * 1 / rateGWPerYear('grid', y), 'grid wait at start = 19 + 4/rate', 1e-9);
    console.log(`   grid wait ${worldWaitQ(s, 'grid').toFixed(3)} q, gas ${worldWaitQ(s, 'gas').toFixed(3)}, rent ${worldWaitQ(s, 'rent').toFixed(3)}`);
    near(rents[0].perQuarter, 0.3 * 1.8 / 4, 'L-rent-S1 per quarter');
    check(rents[0].id === 'L-rent-S1', 'ledger id L-rent-S1');
  }
}
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
