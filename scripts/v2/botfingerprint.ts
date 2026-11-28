// Bot fingerprint: plays each bot over worlds x seeds and records the outcome plus a hash of the final state, so a
// refactor of the bots can be proven to change nothing.
//
//   npx tsx scripts/v2/botfingerprint.ts [--out .scratch/botfp-after.json] [--seeds 6] [--bots ref,mixed]
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { engine } from '../../src/engine/v2';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { refBot } from '../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import type { AlignDiffId, BotPolicy, GameStateV2, WorldPresetId } from '../../src/engine/v2/types';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = arg('out', '.scratch/botfp-after.json');
const SEEDS = Number(arg('seeds', '6'));
const ALL: Record<string, BotPolicy> = { ref: refBot, mixed: mixedBot };
const BOTS = arg('bots', 'ref,mixed').split(',').filter((b) => ALL[b]);
const COMBOS: { world: WorldPresetId; alignment: AlignDiffId }[] = [
  { world: 'tl-central', alignment: 'medium' }, { world: 'tl-fast', alignment: 'sampled' }, { world: 'tl-slow', alignment: 'sampled' },
];

function play(bot: BotPolicy, s: GameStateV2): GameStateV2 {
  let guard = 0;
  while (!s.ending && guard++ < 40000) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s);
  }
  return s;
}

const out: Record<string, unknown>[] = [];
for (const name of BOTS) {
  for (const combo of COMBOS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = newGame(defaultSetupV2({ seed, ...combo, tutorial: false, labKind: 'leader' }));
      play(bot(name), s);
      const e = s.ending;
      out.push({
        bot: name, world: combo.world, alignment: combo.alignment, seed,
        day: e?.day ?? null, ending: e?.id ?? null, verdict: e?.verdict ?? null,
        milestones: s.player.milestoneDays,
        stateHash: createHash('sha256').update(JSON.stringify(s)).digest('hex'),
      });
      console.log(name, combo.world, seed, e?.day, e?.id, e?.verdict);
    }
  }
}
function bot(n: string): BotPolicy { return ALL[n]; }
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} fingerprints to ${OUT}`);
