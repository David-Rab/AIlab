// Start types (BUILD-PLAN R9): catch-up targets and the "overtaken" ending for the non-leader starts.
//
//   npx tsx scripts/v2/starts.ts [--seeds 10] [--bots mixed,race]
//
// research/18 §0.2 targets (STRUCTURE §4.8 "the engine should reproduce these for the matching start types"), with a
// competent bot policy (the mixed bot; the race bot as the capability-first alternative):
//   breakaway    first own model (first version on its own base) 9–12 months behind the leader, 12–17 months in;
//   big tech    6 months behind at the start → 3–5 months within months 9–15;
//   safety-first contender  parity (≤ 0.5 month) possible (in at least one game) within months 12–18.
// "Months behind" = how long ago the simulated leader lab's internal model stood where the player's best model stands
// (before day 0: extrapolated at the leader's start rate). Also reports each start's ending mix: non-leader starts
// should be hard but winnable (some wins; "overtaken" a common loss, not the only outcome).
import { LAB_KIND_BY_ID, POSITION_BY_ID } from '../../src/data/v2/starts';
import { PRE_GAME_G_PER_YEAR } from '../../src/data/v2/runDesign';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { raceBot } from '../../src/engine/v2/bots/race';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import type { BotPolicy, GameStateV2, LabKindId } from '../../src/engine/v2/types';
import { engine } from '../../src/engine/v2';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { check, finish } from './lib';

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SEEDS = Number(arg('seeds', '10'));
const BOTS: Record<string, BotPolicy> = { mixed: mixedBot, race: raceBot };
const BOT_NAMES = arg('bots', 'mixed,race').split(',').filter((b) => BOTS[b]);
const MO = 365 / 12;

interface Game { start: LabKindId; bot: string; seed: number; ending: string; verdict: string; day: number; lagByMonth: number[]; firstOwn?: { month: number; lag: number } }

function play(start: LabKindId, botName: string, seed: number): Game {
  const bot = BOTS[botName];
  const s = newGame(defaultSetupV2({ seed, world: seed % 2 ? 'tl-fast' : 'tl-central', alignment: seed % 4 < 2 ? 'medium' : 'sampled', tutorial: false, labKind: start }));
  const L = s.rivals.find((r) => r.npc.kind === 'leader')!;
  const lPm: number[] = [L.internal.G];
  const rate0 = PRE_GAME_G_PER_YEAR; // G a year: the stated pre-game pace (RD-L03)
  // Months behind at day d for a model at G x: d − (first day the leader reached x).
  const lagAt = (x: number, d: number) => {
    if (x >= lPm[d]) return 0;
    if (x < lPm[0]) return (d + ((lPm[0] - x) / rate0) * 365) / MO;
    let i = 0;
    while (lPm[i] < x) i++;
    return (d - i) / MO;
  };
  const best = (g: GameStateV2) => g.player.models.versions.reduce((a, v) => (v.variant === 'imported' || v.status === 'retired' ? a : Math.max(a, v.G)), -Infinity);
  const ownBase = (g: GameStateV2) => new Set(g.player.models.bases.filter((b) => !b.name.includes('imported')).map((b) => b.id));
  const out: Game = { start, bot: botName, seed, ending: '', verdict: '', day: 0, lagByMonth: [] };
  let guard = 0;
  while (!s.ending && guard++ < 40000) {
    for (const p of [...s.events.pending]) if (resolve(s, p.instance, bot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    bot.act(s, engine);
    tick(s);
    const d = s.time.day;
    lPm[d] = Math.max(lPm[d - 1], L.internal.G);
    if (!out.firstOwn) {
      const own = ownBase(s);
      const v = s.player.models.versions.find((x) => own.has(x.baseId) && x.variant === 'full' && x.day > 0);
      if (v && start === 'breakaway') out.firstOwn = { month: d / MO, lag: lagAt(v.G, d) };
    }
    if (d % 30 === 0) {
      const b = best(s);
      out.lagByMonth.push(Number.isFinite(b) ? lagAt(b, d) : lagAt(s.player.models.versions[0].G, d));
    }
  }
  return { ...out, ending: s.ending?.id ?? '', verdict: s.ending?.verdict ?? '', day: s.time.day };
}

const games: Game[] = [];
const t0 = performance.now();
for (const start of ['safety', 'racer', 'bigtech', 'breakaway', 'newcomer'] as LabKindId[]) {
  for (const b of BOT_NAMES) for (let i = 0; i < SEEDS; i++) games.push(play(start, b, 30_000 + i));
  process.stderr.write(`  ${start}: ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
}

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);
const window = (g: Game, a: number, b: number) => g.lagByMonth.slice(a, b + 1);

console.log('\nMonths behind the leader lab (median over games; months 0 / 6 / 12 / 18 / 24):');
for (const start of ['safety', 'racer', 'bigtech', 'breakaway', 'newcomer'] as LabKindId[]) {
  for (const b of BOT_NAMES) {
    const gs = games.filter((g) => g.start === start && g.bot === b);
    const at = (m: number) => f1(med(gs.map((g) => g.lagByMonth[m]).filter((x) => x !== undefined)));
    console.log(`  ${start.padEnd(10)} ${b.padEnd(6)} ${[0, 6, 12, 18, 24].map(at).join(' / ')}`);
  }
}

// Spinout: first own model 9–12 months behind, 12–17 months in (median over games that shipped one).
const sp = games.filter((g) => g.start === 'breakaway' && g.firstOwn);
const spMonth = med(sp.map((g) => g.firstOwn!.month));
const spLag = med(sp.map((g) => g.firstOwn!.lag));
check(sp.length > 0 && spMonth >= 12 && spMonth <= 17 && spLag >= 9 && spLag <= 12, 'breakaway: first own model 9–12 months behind, 12–17 months in', `${sp.length}/${games.filter((g) => g.start === 'breakaway').length} shipped one; median month ${f1(spMonth)}, lag ${f1(spLag)} mo`);
// Big tech: 6 → 3–5 months within months 9–15 (the median game's best lag in that window).
const bt = games.filter((g) => g.start === 'bigtech').map((g) => Math.min(...window(g, 9, 15)));
check(med(bt) >= 3 && med(bt) <= 5, 'big tech: 6 → 3–5 months behind within months 9–15', `median best lag in months 9–15 ${f1(med(bt))} mo (games: ${bt.map(f1).join(', ')})`);
// Challenger: parity (≤ 0.5 mo) possible within months 12–18.
const ch = games.filter((g) => g.start === 'safety').map((g) => Math.min(...window(g, 12, 18)));
check(ch.some((x) => x <= 0.5), 'safety-first contender: parity possible within months 12–18', `best lag in months 12–18 per game: ${ch.map(f1).join(', ')}`);

console.log('\nEndings by start (bots ' + BOT_NAMES.join(', ') + '):');
for (const start of ['safety', 'racer', 'bigtech', 'breakaway', 'newcomer'] as LabKindId[]) {
  const gs = games.filter((g) => g.start === start);
  const n = gs.length;
  const wins = gs.filter((g) => g.verdict === 'win').length;
  const mix = new Map<string, number>();
  for (const g of gs) mix.set(g.ending, (mix.get(g.ending) ?? 0) + 1);
  const top = [...mix.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`  ${start.padEnd(10)} [${POSITION_BY_ID[LAB_KIND_BY_ID[start].position].difficulty}] win ${wins}/${n} · ${top}`);
  const over = gs.filter((g) => g.ending === 'overtaken').length;
  check(wins > 0 && over < n, `${start}: hard but winnable (some wins; overtaken not the only outcome)`, `${wins} wins, ${over} overtaken of ${n}`);
}
console.log(`total ${((performance.now() - t0) / 1000).toFixed(0)} s`);
finish('starts');
