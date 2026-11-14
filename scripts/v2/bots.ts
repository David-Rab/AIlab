// Bot harness (V2-SPEC §7.4): N seeds per bot over medium/sampled alignment × ai2027/sampled worlds, Realistic
// actors, Rising storyteller. Reports win / mixed / loss, the ending mix, the §7.4 pass criteria and ending coverage
// (E5, statistical). Owner: WS4.
//
//   npx tsx scripts/v2/bots.ts [--seeds 200] [--bots race,safe,mixed,capex2x,ref] [--json out.json]
//
// The criteria are informational until integration (M2+): with M0 placeholders, progress and traits do not respond
// to player levers, so every bot reaches the same milestones on the same days.
import { writeFileSync } from 'node:fs';
import { engine } from '../../src/engine/v2';
import { capex2xBot } from '../../src/engine/v2/bots/capex2x';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { raceBot } from '../../src/engine/v2/bots/race';
import { refBot } from '../../src/engine/v2/bots/ref';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import type { AlignDiffId, BotPolicy, EndingId, EndingV2, GameStateV2, WorldPresetId } from '../../src/engine/v2/types';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SEEDS = Number(arg('seeds', '200'));
const ALL: Record<string, BotPolicy> = { race: raceBot, safe: safeBot, mixed: mixedBot, capex2x: capex2xBot, ref: refBot };
const BOTS = arg('bots', 'race,safe,mixed,capex2x,ref').split(',').filter((b) => ALL[b]);
const COMBOS: { world: WorldPresetId; alignment: AlignDiffId }[] = [
  { world: 'ai2027', alignment: 'medium' }, { world: 'ai2027', alignment: 'sampled' },
  { world: 'sampled', alignment: 'medium' }, { world: 'sampled', alignment: 'sampled' },
];

export interface RunResult { bot: string; seed: number; world: string; alignment: string; ending: EndingId; verdict: EndingV2['verdict']; day: number; scores: EndingV2['scores']; power: string }

/** Play one game with a bot until it ends (the endings system caps it at 2050-12-31). */
export function playBot(bot: BotPolicy, s: GameStateV2): GameStateV2 {
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

const TAKEOVER: EndingId[] = ['asiTakeover', 'rivalTakeover', 'chinaTakeover', 'rogue'];
const COMPANY: EndingId[] = ['insolvent', 'ousted', 'acquired', 'nationalized'];
const OTHER_FIRST: EndingId[] = ['overtaken', 'rivalAligned', 'rivalTakeover', 'chinaAligned', 'chinaTakeover'];

function main() {
  const results: RunResult[] = [];
  const t0 = performance.now();
  for (const name of BOTS) {
    const bot = ALL[name];
    for (let i = 0; i < SEEDS; i++) {
      const combo = COMBOS[i % COMBOS.length];
      const seed = 10_000 + i;
      const s = newGame(defaultSetupV2({ seed, ...combo, econ: combo.world === 'ai2027' ? 'ai2027' : 'sampled', storyteller: 'rising', tutorial: false, gov: 'realistic', public: 'realistic', china: 'realistic', rivals: 'realistic' }));
      playBot(bot, s);
      const e = s.ending!;
      results.push({ bot: name, seed, ...combo, ending: e.id, verdict: e.verdict, day: e.day, scores: e.scores, power: e.power });
    }
    process.stderr.write(`  ${name}: ${SEEDS} runs (${((performance.now() - t0) / 1000).toFixed(0)} s)\n`);
  }

  const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`.padStart(6);
  console.log(`\nBot harness — ${SEEDS} seeds per bot (${COMBOS.map((c) => `${c.world}/${c.alignment}`).join(', ')}), Rising storyteller\n`);
  console.log('bot      runs   win    mixed  loss   med.day  top endings');
  const winRate: Record<string, number> = {};
  for (const name of BOTS) {
    const rs = results.filter((r) => r.bot === name);
    const n = rs.length;
    const w = rs.filter((r) => r.verdict === 'win').length;
    const m = rs.filter((r) => r.verdict === 'mixed').length;
    const l = rs.filter((r) => r.verdict === 'loss').length;
    winRate[name] = w / Math.max(1, n);
    const days = rs.map((r) => r.day).sort((a, b) => a - b);
    const mix = new Map<string, number>();
    for (const r of rs) mix.set(r.ending, (mix.get(r.ending) ?? 0) + 1);
    const top = [...mix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${pct(v, n).trim()}`).join(', ');
    console.log(`${name.padEnd(8)} ${String(n).padStart(4)} ${pct(w, n)} ${pct(m, n)} ${pct(l, n)}  ${String(days[Math.floor(n / 2)] ?? 0).padStart(6)}   ${top}`);
  }

  // §7.4 pass criteria (binding after integration; informational under M0 placeholders).
  console.log('\n§7.4 criteria (informational until M2 integration):');
  const share = (name: string, set: EndingId[], onlyLoss = true) => {
    const rs = results.filter((r) => r.bot === name && (!onlyLoss || r.verdict === 'loss'));
    return rs.length ? rs.filter((r) => set.includes(r.ending)).length / rs.length : 0;
  };
  const line = (ok: boolean, txt: string) => console.log(`  ${ok ? 'MET ' : 'MISS'}  ${txt}`);
  if (BOTS.includes('race')) {
    line(winRate.race <= 0.05, `race win ≤ 5% (${(100 * winRate.race).toFixed(1)}%)`);
    line(share('race', TAKEOVER) >= 0.3 && share('race', COMPANY) >= 0.2, `race losses ≥ 30% takeover/rogue (${(100 * share('race', TAKEOVER)).toFixed(0)}%) and ≥ 20% company-loss (${(100 * share('race', COMPANY)).toFixed(0)}%)`);
  }
  if (BOTS.includes('safe')) {
    line(winRate.safe <= 0.05, `safe win ≤ 5% (${(100 * winRate.safe).toFixed(1)}%)`);
    line(share('safe', OTHER_FIRST) >= 0.5, `safe losses ≥ 50% overtaken/other-ASI-first (${(100 * share('safe', OTHER_FIRST)).toFixed(0)}%)`);
  }
  if (BOTS.includes('mixed')) {
    const gap = winRate.mixed - Math.max(winRate.race ?? 0, winRate.safe ?? 0);
    line(winRate.mixed >= 0.3 && gap >= 0.25, `mixed win ≥ 30% (${(100 * winRate.mixed).toFixed(1)}%) and ≥ 25 pp above both extremes (${(100 * gap).toFixed(1)} pp)`);
  }
  if (BOTS.includes('ref')) {
    const rs = results.filter((r) => r.bot === 'ref' && r.world === 'ai2027' && r.alignment === 'medium');
    const tk = rs.length ? rs.filter((r) => TAKEOVER.includes(r.ending)).length / rs.length : 0;
    line(tk >= 0.5, `passive (ai2027/medium) takeover-type ≥ 50%, diagnostic (${(100 * tk).toFixed(0)}%)`);
  }

  // E5 (statistical): ending coverage across all runs.
  const ALL_ENDINGS: EndingId[] = ['asiAligned', 'asiContested', 'asiTakeover', 'rivalAligned', 'rivalTakeover', 'chinaAligned', 'chinaTakeover', 'overtaken', 'catastropheBio', 'catastropheCyber', 'war', 'rogue', 'insolvent', 'ousted', 'nationalized', 'acquired', 'retired'];
  const seen = new Set(results.map((r) => r.ending));
  console.log(`\nE5 coverage over ${results.length} runs: ${seen.size}/${ALL_ENDINGS.length} endings seen; missing: ${ALL_ENDINGS.filter((e) => !seen.has(e)).join(', ') || 'none'}`);
  console.log(`total ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  const out = arg('json', '');
  if (out) writeFileSync(out, JSON.stringify(results));
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/v2/bots.ts')) main();
