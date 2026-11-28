// Idle test (STRUCTURE §8, rule R5): no resource stock stays unused for 30 days in bot games without an alert.
// Stocks with no default use are listed by the engine (core/limitsView.ts idleStocks: dark chips, science teams with no
// project, serving compute no product needs); every one of them, once idle for 30 days, must have its alert: an item
// in the Watch list (the one alert channel) or a nav badge (ui/v2/shell/watch.ts IDLE_ALERT). Stocks with a default use (spare training compute →
// experiments or data, safety research engineers → tool upkeep) are checked to really flow there.
//   npx tsx scripts/v2/idle.ts [--seeds 3] [--days 1100]
import { engine } from '../../src/engine/v2';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { refBot } from '../../src/engine/v2/bots/ref';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { raceBot } from '../../src/engine/v2/bots/race';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { IDLE_STOCK_IDS, idleStocks, type IdleStockId } from '../../src/engine/v2/core/limitsView';
import { idleTrainingShare } from '../../src/engine/v2/models/runs';
import { expPoolH100e } from '../../src/engine/v2/models/research';
import { poolsOf } from '../../src/engine/v2/compute/power';
import { IDLE_ALERT, navBadges, watchItems } from '../../src/ui/v2/shell/watch';
import type { BotPolicy, GameStateV2, LabKindId } from '../../src/engine/v2/types';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SEEDS = Number(arg('seeds', '2'));
const DAYS = Number(arg('days', '1100'));
const IDLE_DAYS = 30;
const BOTS: Record<string, BotPolicy> = { ref: refBot, mixed: mixedBot, safe: safeBot, race: raceBot };
const KINDS: LabKindId[] = ['leader', 'safety'];

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
};

function step(bot: BotPolicy, s: GameStateV2) {
  for (const p of [...s.events.pending]) {
    const c = bot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  bot.act(s, engine);
  tick(s);
}

// Every idle stock kind has its Watch item.
ok('Every idle stock has an alert (Watch item or nav badge)', IDLE_STOCK_IDS.every((id) => !!(IDLE_ALERT[id]?.watch || IDLE_ALERT[id]?.badge)), IDLE_STOCK_IDS.join(', '));

const seen: Record<IdleStockId, number> = { chips: 0, scienceTeams: 0, serving: 0 };
const misses: string[] = [];
let samples = 0;
let spareChecked = 0;
let spareLost = 0;
for (const start of KINDS) {
  for (const [name, bot] of Object.entries(BOTS)) {
    for (let k = 0; k < SEEDS; k++) {
      const seed = 9100 + k;
      const s = newGame(defaultSetupV2({ seed, world: k % 2 ? 'tl-fast' : 'tl-central', tutorial: false, start }));
      const since: Partial<Record<IdleStockId, number>> = {};
      while (!s.ending && s.time.day < DAYS) {
        step(bot, s);
        const idle = idleStocks(s);
        const now = new Set(idle.map((x) => x.id));
        for (const id of IDLE_STOCK_IDS) {
          if (!now.has(id)) delete since[id];
          else since[id] ??= s.time.day;
        }
        if (s.time.day % 7) continue;
        samples++;
        const items = new Set(watchItems(s).map((w) => w.id));
        const badges = navBadges(s);
        for (const id of IDLE_STOCK_IDS) {
          const from = since[id];
          if (from === undefined || s.time.day - from < IDLE_DAYS) continue;
          seen[id]++;
          const a = IDLE_ALERT[id];
          if (!((a.watch && items.has(a.watch)) || (a.badge && badges[a.badge]))) misses.push(`${start}/${name}/${seed} day ${s.time.day}: ${id} idle since ${from} with no alert`);
        }
        // RD-A05b (DD-19): idle training compute stays idle; it must not reach experiments or data on its own.
        const spare = idleTrainingShare(s) * poolsOf(s).training;
        if (spare > 1000) {
          spareChecked++;
          if (!s.player.policies.autoSplit.on && Math.abs(expPoolH100e(s) - poolsOf(s).experiments) > 1e-6) spareLost++;
        }
      }
    }
  }
}
console.log(`samples ${samples} (weekly) · idle ≥ ${IDLE_DAYS} d seen: ${IDLE_STOCK_IDS.map((id) => `${id} ${seen[id]}`).join(' · ')}`);
ok(`No stock idle ${IDLE_DAYS} d without an alert`, misses.length === 0, misses.slice(0, 6).join(' | '));
ok('Idle training compute stays idle (Auto-split off)', spareLost === 0, `${spareChecked} samples with spare training compute`);

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
