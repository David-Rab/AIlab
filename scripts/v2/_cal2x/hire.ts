// CAL2-X probe: first day HireRate_SOFT ≤ 10% under hireSlope 1.5 and 1.2, from the SOFT coverage path ΔF = F − F_preLLM
// (hire = 1 − slope·ΔF; the slope feeds nothing upstream of F). One RefBot classic run per seed.
// Run alone: npx tsx scripts/v2/_cal2x/hire.ts [seed]
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { preLlmCover } from '../../../src/engine/v2/worldfx/serving';

const seed = Number(process.argv[2] ?? 2027);
const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
const END = dayOfDate('2025-07-01', '2028-07-01');
const SLOPES = [1.5, 1.2];
const first: Record<number, number | undefined> = {};
const date = (d?: number) => (d === undefined ? 'never' : new Date(Date.parse('2025-07-01') + d * 864e5).toISOString().slice(0, 10));
while (s.time.day < END && SLOPES.some((k) => first[k] === undefined)) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  const dF = s.world.sectors.US.SOFT.F - preLlmCover(s.hidden.timeline).SOFT;
  for (const k of SLOPES) if (first[k] === undefined && 1 - k * dF <= 0.1) first[k] = s.time.day;
}
console.log(`seed ${seed} first HireRate_SOFT <= 10%: ${SLOPES.map((k) => `slope ${k} ${date(first[k])}`).join(', ')}`);
