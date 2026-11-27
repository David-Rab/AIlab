// N1 test: the reference frontier reader (engine/v2/npc/reference.ts). 3 runs per timeline.
// Run: npx tsx scripts/v2/npcReference.ts
import { TIMELINE_DRAWS, type TimelineId } from '../../src/data/v2/timelineDraws';
import { TIMELINE_PROGRESS, SERIES_ANCHOR, SERIES_FROM, SERIES_STEP, SERIES_G0 } from '../../src/data/v2/timelineSeries';
import { drawAt } from '../../src/data/v2/timelineWorlds';
import { refG, clockOfG } from '../../src/engine/v2/npc/reference';

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log('FAIL', msg); } };
const stateOf = (tl: TimelineId, index: number, world = `tl-${tl}`) => ({ setup: { world }, hidden: { timeline: { aifmRun: { index, id: '' } } } }) as never;

let maxAcErr = 0, rows = 0;
for (const tl of ['fast', 'central', 'slow'] as TimelineId[]) {
  const d = TIMELINE_DRAWS[tl];
  check(TIMELINE_PROGRESS[tl].length === d.rows.length, `${tl}: one series per run`);
  const n = d.rows.length;
  for (const index of [0, Math.floor(n / 2), n - 1]) {
    const s = stateOf(tl, index);
    const gSC = drawAt(tl, index).v3.gSC, ac = d.dates[index][0] as number;
    check(Math.abs(refG(s, SERIES_ANCHOR)! - SERIES_G0[tl]) < 1e-9, `${tl}[${index}]: G at 2025.445 = G(V0)`);
    check(refG(s, 2000) === SERIES_G0[tl], `${tl}[${index}]: flat before the anchor`);
    const e = Math.abs(refG(s, ac)! - gSC); maxAcErr = Math.max(maxAcErr, e); rows++;
    check(e < 0.05, `${tl}[${index}]: G at AC ${e.toFixed(4)} from gSC`);
    const p = TIMELINE_PROGRESS[tl][index], last = SERIES_FROM + (p.length - 1) * SERIES_STEP;
    check(refG(s, last + 5) === refG(s, last), `${tl}[${index}]: flat after the end`);
    // round trip on the running maximum: clockOfG(refG(t)) <= t, and equal wherever progress is at its running max
    let rm = -Infinity;
    for (let t = SERIES_ANCHOR + 0.01; t < last; t += 0.07) {
      const g = refG(s, t)!;
      const back = clockOfG(s, g)!;
      check(back <= t + 1e-6, `${tl}[${index}]: clockOfG(refG(${t.toFixed(2)})) = ${back} is not earlier`);
      rm = Math.max(rm, g - SERIES_G0[tl]);
      if (g - SERIES_G0[tl] >= rm - 1e-12) check(Math.abs(back - t) < 1e-6, `${tl}[${index}]: round trip at ${t.toFixed(2)} gave ${back}`);
    }
    check(clockOfG(s, 1e9) === Infinity, 'above the series is Infinity');
    check(clockOfG(s, SERIES_G0[tl] - 1) === SERIES_ANCHOR, 'below G(V0) is the anchor');
  }
}
const other = stateOf('fast', 0, 'authors2026');
check(refG(other, 2030) === undefined && clockOfG(other, 30) === undefined, 'a world without a draw gives undefined');
console.log(`checked ${rows} runs, max |G(AC) - gSC| = ${maxAcErr.toFixed(4)}`);
console.log(fails ? `${fails} FAILED` : 'ok');
process.exit(fails ? 1 : 0);
