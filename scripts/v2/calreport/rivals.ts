// Calibration targets: rivals and China (moved from calib.ts T4 and directorEndings.ts T3, T4; design/TESTING.md §0).
//   Rival gaps at start: ONE target (CAST.rivalGaps.start, the CAST-2025 0–11 months band; the old calib T4 3–9 months is gone).
//   China: the start lag is the sourced 6.5–8 months (design/bal/SC1-SPEC.md:30; npc/CAST-2025.md "China gap check": IFP
//     6.5, CAISI ~8, Epoch mean 7); on RefBot play (no theft, days 30–540, daily) China trails the US frontier (the best of
//     the player and the active rivals) by 90–270 d on average (the cast span) and on ≥ 95% of days.
// Cost: gaps = newGame only (no ticks); China at start 4 newGames + 1 tick; China trail = RefBot games of 540 days
// (≈ 20 CPU-s each cold, through simcache).
// Env: CALREPORT_SEEDS=n caps every seed list of this module (default: 40 gap seeds, 3 China-trail games, 4 start-lag worlds).
import { fileURLToPath } from 'node:url';
import { CHINAGOV } from '../../../src/engine/v2/world/chinagov';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { bestG } from '../../../src/engine/v2/models/labs';
import { lagDays } from '../../../src/engine/v2/models/capability';
import type { GameStateV2, LabId } from '../../../src/engine/v2/types';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { engine } from '../../../src/engine/v2/index';
import { cached } from '../simcache';
import { rowOf, type Target } from './types';

export const area = 'rivals';

const ME = [fileURLToPath(import.meta.url)];
/** Lead of lab a over lab b in days (the lead clock). */
const leadBetween = (s: GameStateV2, a: LabId, b: LabId): number => lagDays(s, b, a);
const capSeeds = (dflt: number) => Math.min(dflt, Number(process.env.CALREPORT_SEEDS ?? dflt));

/** Rival gaps at start in months over the fixture seed and `n` seeds (classic setup): every rival of every world. */
function rivalGapMonths(n: number): number[] {
  return cached('calreport-rival-gaps', { n }, ME, () => {
    const months: number[] = [];
    const fx = newGame(defaultSetupV2({ seed: 2027, alignment: 'medium' }));
    for (const r of fx.rivals) months.push(leadBetween(fx, 'player', r.core.id) / 30.4);
    for (let seed = 1; seed <= n; seed++) {
      const s = newGame(defaultSetupV2({ seed }));
      for (const r of s.rivals) months.push(leadBetween(s, 'player', r.core.id) / 30.4);
    }
    return months;
  });
}

/** China's lead over the player's frontier, daily over days 30–540 of RefBot play with no natural theft, `n` games. */
function chinaTrail(n: number): number[] {
  return cached('calreport-china-trail', { seeds: n, days: 540 }, ME, () => {
    const pre: number[] = [];
    const minRung = CHINAGOV.theftRung;
    CHINAGOV.theftRung = 99;
    for (let seed = 1; seed <= n; seed++) {
      const s = newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
      tick(s, { skip: ['endings'] });
      const usFrontier = (): LabId => [...s.rivals.filter((r) => r.core.status === 'active').map((r) => r.core.id), 'player' as LabId].reduce((a, b) => (bestG(s, b) > bestG(s, a) ? b : a));
      while (s.time.day < 540 && !s.ending) { // band-lint: ok measurement window (days 30-540)
        refBot.act(s, engine);
        tick(s, { skip: ['endings'] });
        if (s.time.day >= 30) pre.push(leadBetween(s, usFrontier(), 'china')); // band-lint: ok measurement window (days 30-540)
      }
    }
    CHINAGOV.theftRung = minRung;
    return pre;
  });
}

/** China's lead over the player after one tick of a fresh game, in days, no natural theft. */
function chinaStartLeads(n: number): number[] {
  const minRung = CHINAGOV.theftRung;
  CHINAGOV.theftRung = 99;
  const leads: number[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const s = newGame(defaultSetupV2({ seed, alignment: 'medium', tutorial: false }));
    tick(s, { skip: ['endings'] });
    leads.push(leadBetween(s, 'player', 'china'));
  }
  CHINAGOV.theftRung = minRung;
  return leads;
}

export function targets(): Target[] {
  const out: Target[] = [];

  // Rival gaps at start: the registry band (CAST-2025).
  const months = [...rivalGapMonths(capSeeds(40))].sort((a, b) => a - b);
  out.push(rowOf('CAST.rivalGaps.start', `${months[0].toFixed(2)}–${months[months.length - 1].toFixed(2)} (median ${months[months.length >> 1].toFixed(2)}, ${months.length} rival gaps; the fixture seed 2027 and the seed set)`, months));

  // China's lead at the start: 6.5–8 months.
  const leads0 = chinaStartLeads(capSeeds(4));
  out.push(rowOf('CAST.china.startLead', leads0.map((x) => `${x.toFixed(0)} d`).join(', '), leads0.map((x) => x / 30.4)));

  // China trails the US frontier on RefBot play, no theft.
  const nT3 = capSeeds(3);
  const pre = chinaTrail(nT3);
  const mean = pre.reduce((a, x) => a + x, 0) / Math.max(1, pre.length);
  const behind = pre.filter((x) => x > 0).length / Math.max(1, pre.length);
  const sorted = [...pre].sort((a, b) => a - b);
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  out.push(rowOf('CAST.china.trailMean', `mean ${mean.toFixed(0)} d; p10 ${pct(0.1).toFixed(0)}, median ${pct(0.5).toFixed(0)}, p90 ${pct(0.9).toFixed(0)} d (${nT3} seeds)`, pre.length > 0 ? mean : NaN));
  out.push(rowOf('CAST.china.behindShare', `${(100 * behind).toFixed(1)}% of ${pre.length} daily readings`, pre.length > 0 ? behind : NaN));
  return out;
}
