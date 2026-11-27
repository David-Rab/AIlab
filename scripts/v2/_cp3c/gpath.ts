// CP3c probe: calib's V3.7 / §13 reads on seed 2027 (frontier G path line, h50 doubling to 2027.0, M at day 1) plus
// RefBot's milestone days, for one or more presets. Same expressions as scripts/v2/calib.ts t1Rec.
import { defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { refGame, runRef } from '../lib';
import { bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { gOfBuild, h50Of } from '../../../src/engine/v2/models/capability';
import { START_DATE, dayOfDate } from '../../../src/engine/v2/core/time';
import { REF_TPP } from '../../../src/data/v2/runDesign';
import { fOver } from '../../../src/engine/v2/models/effective';
import { CAL_SEED } from '../calseeds';
const OVER_DG = Math.log10(fOver(REF_TPP) / fOver(50));
const ANCH = ([['2025-08-15', 28.0], ['2025-11-15', 28.4], ['2026-02-15', 28.7], ['2026-04-15', 29.0], ['2026-10-15', 29.4]] as [string, number][]).map(([d, g]) => [d, g + OVER_DG] as [string, number]);
const FROM = dayOfDate(START_DATE, '2025-08-01'), TO = dayOfDate(START_DATE, '2026-11-30'), D27 = dayOfDate(START_DATE, '2027-01-01');
const seed = Number(process.env.SEED ?? CAL_SEED);
for (const preset of (process.argv[2] ?? 'tl-central').split(',')) {
  const maxDay = Number(process.argv[3] ?? 0) || (preset === 'tl-slow' ? 5200 : 3400);
  const s = refGame(defaultSetupV2({ world: preset as any, alignment: 'medium', seed }));
  let M = 0, h0 = 0, h1 = 0;
  const gp: { day: number; g: number }[] = [];
  runRef(s, maxDay, (x) => {
    const bv = bestPlayerVersion(x);
    if (x.time.day === 1) M = x.player.research.last?.x?.mExp ?? 0;
    if (bv && x.time.day === 0) h0 = h50Of(x.hidden.timeline, bv);
    if (bv && x.time.day === D27) h1 = h50Of(x.hidden.timeline, bv);
    if (bv?.build && x.time.day >= FROM && x.time.day <= TO) gp.push({ day: x.time.day, g: gOfBuild(bv.build) });
    return x.player.milestoneDays[preset === 'tl-slow' ? 3 : 6] !== undefined;
  });
  const n = gp.length, mx = gp.reduce((a, r) => a + r.day, 0) / n, my = gp.reduce((a, r) => a + r.g, 0) / n;
  const slope = gp.reduce((a, r) => a + (r.day - mx) * (r.g - my), 0) / gp.reduce((a, r) => a + (r.day - mx) ** 2, 0);
  const rows = ANCH.map(([d, g]) => { const dd = dayOfDate(START_DATE, d); return `${d} ${(my + slope * (dd - mx) - g).toFixed(2)}`; });
  const worst = Math.max(...ANCH.map(([d, g]) => Math.abs(my + slope * (dayOfDate(START_DATE, d) - mx) - g)));
  const months = (D27 / 30.44) / Math.log2(h1 / h0);
  console.log(`${preset} seed ${seed}: M ${M.toFixed(3)} | G path worst ${worst.toFixed(2)} slope ${(slope * 365).toFixed(2)} G/yr (fit−anchor: ${rows.join(', ')}) | h50 ${Math.round(h1)} min at 2027.0, doubling ${months.toFixed(1)} mo | milestones ${JSON.stringify(s.player.milestoneDays)}`);
}
