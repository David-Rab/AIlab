// L11: the labour market's start state (design/bal/LABOUR-ROUND.md §4.1, §6.1): pools, the pay ladder, premiums, stars.
// Cost: 4 newGame, no sim. Tier: quick, full.
// Run: npx tsx scripts/v2/labourinit.ts   (PASS/FAIL lines, exit 1 on any failure)
import { newGame, defaultSetupV2, initialLabour } from '../../src/engine/v2/core/init';
import { STREAMS, seedStreams } from '../../src/engine/v2/core/rng';
import { tasteSigma } from '../../src/engine/v2/production/ces';
import { P0, W0, W_STAR0, PREMIUM_STEPS, STAR_TOP_PERCENTILE, STAR_EMPLOYER0 } from '../../src/data/v2/labourMarket';

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};
const kinds = ['eng', 're', 'sci'] as const;
const Z999 = 3.090232306167813;

const SEED = 1;
const s = newGame(defaultSetupV2({ seed: SEED } as never));
const L = s.labour;

check(kinds.every((k) => L.pools[k].P === P0[k] && L.pools[k].w === W0[k]), 'pools start at P0 with w = w0', kinds.map((k) => `${k} ${L.pools[k].P} @ ${L.pools[k].w}`).join(', '));
check(kinds.every((k) => s.player.pay[k] === W0[k]), 'p.pay = w0');
check(kinds.every((k) => s.player.hiring.premium[k] === 0) && PREMIUM_STEPS[0] === 0, 'premiums start at 0 (a PREMIUM_STEPS step)');
check(W0.eng < W0.re && W0.re < W0.sci && W0.sci < W_STAR0, 'pay ladder: engineer < research engineer < scientist < star');

const n = Math.round((1 - STAR_TOP_PERCENTILE) * P0.sci);
check(n === 37 && L.stars.length === 37, '37 stars', String(L.stars.length));
const sigma = tasteSigma(s.hidden.timeline.prod.m2b);
const lo = Math.exp(-0.5 * sigma * sigma + sigma * Z999) * (1 - 1e-3); // the 99.9th percentile taste (Phi is good to 1.5e-7)
const hi = Math.exp(-0.5 * sigma * sigma + sigma * 5);               // 5 SD, the cap of the draw
const T = L.stars.map((x) => x.taste).sort((a, b) => a - b);
check(T[0] >= lo && T[T.length - 1] <= hi, 'star tastes above the 99.9th percentile and below the 5 SD bound',
  `m2b ${s.hidden.timeline.prod.m2b.toFixed(2)}, sigma ${sigma.toFixed(3)}; min ${T[0].toFixed(2)} median ${T[18].toFixed(2)} max ${T[36].toFixed(2)} (bounds ${lo.toFixed(2)}..${hi.toFixed(2)})`);
check(L.stars.every((x) => x.pay === W_STAR0) && new Set(L.stars.map((x) => x.id)).size === 37 && new Set(L.stars.map((x) => x.name)).size === 37, 'stars have pay 50, unique ids and names');

const mine = L.stars.filter((x) => x.employer === 'player').length;
const want = Math.round(STAR_EMPLOYER0.openai * 37);
check(mine === want, `player holds round(0.20 x 37) stars`, `${mine} (want ${want})`);
check(L.stars.every((x) => x.employer === 'player' || x.employer === 'outside'), 'NPC labs hold no stars: every star is the player\'s or outside');

// Determinism: same seed, same stars; another seed differs.
const again = newGame(defaultSetupV2({ seed: SEED } as never));
check(JSON.stringify(again.labour) === JSON.stringify(L), 'same seed gives the same labour state');
const other = newGame(defaultSetupV2({ seed: SEED + 1 } as never));
check(JSON.stringify(other.labour.stars) !== JSON.stringify(L.stars), 'another seed gives other stars');

// Stream isolation: the labour draws touch no stream but 'labour' (a shape check: call initialLabour on a copy of the day-0
// streams and compare every stream before and after; no pinned stream value). 'labour' is its own stream, new at day 0
// (seeded by its own name), and every stream except 'world' (consumed by newGame's other draws) and 'labour' is still at
// its seed at day 0.
const seeds = seedStreams(SEED);
const untouched = STREAMS.filter((id) => id !== 'world' && id !== 'labour');
check(STREAMS.includes('labour') && s.rng.labour !== seeds.labour, "'labour' is its own stream and was consumed");
check(untouched.every((id) => s.rng[id] === seeds[id]), 'other streams still at their seeds at day 0');
{
  const rng = { ...s.rng, labour: seeds.labour };
  const before = { ...rng };
  const lab = initialLabour({ rng, hidden: s.hidden }, s.player);
  check(STREAMS.every((id) => (id === 'labour') === (rng[id] !== before[id])), "initialLabour consumes the 'labour' stream and no other (incl. 'world')");
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
