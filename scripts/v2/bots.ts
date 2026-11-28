// Bot harness (V2-SPEC §7.4): N seeds per bot over medium/sampled alignment × ai2027/sampled worlds, Realistic
// actors. Reports win / mixed / loss, the ending mix, the §7.4 pass criteria and ending coverage
// (E5, statistical). Owner: WS4.
//
//   npx tsx scripts/v2/bots.ts [--seeds 200] [--bots race,safe,mixed,capex2x,ref] [--start leader] [--json out.json]
//
// --start spinout|challenger|bigtech|leader (R9): the start type; the leader lab follows it (D1: on for every start
// but the leader's). The §7.4 criteria are defined on the leader start; other starts report the difficulty table.
//
// The criteria are informational until integration (M2+): with M0 placeholders, progress and traits do not respond
// to player levers, so every bot reaches the same milestones on the same days.
import { readFileSync, writeFileSync } from 'node:fs';
import { bestPlayerVersion } from '../../src/engine/v2/models/labs';
import { misalignment } from '../../src/engine/v2/safety/traits';
import type { AlignDiffId, EndingId, EndingV2, GameStateV2, StartType, TraitId, WorldPresetId } from '../../src/engine/v2/types';
import { ALL, newBotGame, playBot } from './botgame';

// The game loop (playBot), the bot table and the game setup live in botgame.ts, shared with balrun.ts.
export { playBot };

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const SEEDS = Number(arg('seeds', '200'));
const BOTS = arg('bots', 'race,safe,mixed,capex2x,ref').split(',').filter((b) => ALL[b]);
const START = arg('start', 'leader') as StartType;
const COMBOS: { world: WorldPresetId; alignment: AlignDiffId }[] = [
  { world: 'tl-central', alignment: 'medium' }, { world: 'tl-central', alignment: 'sampled' },
  { world: 'tl-fast', alignment: 'medium' }, { world: 'tl-fast', alignment: 'sampled' },
  { world: 'tl-slow', alignment: 'medium' }, { world: 'tl-slow', alignment: 'sampled' },
];

export interface RunResult {
  bot: string; seed: number; start?: string; world: string; alignment: string; ending: EndingId; verdict: EndingV2['verdict']; day: number; scores: EndingV2['scores']; power: string;
  /** TRUE Mis of the player's best version at the end (hidden; the choices-vs-world diagnostic) and at the player's ASI. */
  mis: number; misAsi?: number; L: number; U: number; gapTrue: number;
  /** World features for the diagnostic: λ1–λ6, ln D, doomThreshold. */
  world6: number[]; lnD: number; doom: number;
  traits: Partial<Record<TraitId, number>>;
}

const KEY_TRAITS: TraitId[] = ['RH', 'SYC', 'PERSONA', 'CONCEAL', 'EA', 'OBF', 'AF', 'SCHEME', 'POWER', 'SAND', 'SUCC', 'COLLUDE', 'TGAME', 'HONEST', 'CORRIG'];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Hidden Mis and world features of a finished game (diagnostic only). */
export function misRecord(s: GameStateV2) {
  const v = bestPlayerVersion(s);
  const lat = s.hidden.latents;
  const S = s.series;
  const asi = s.ending?.epilogue.asiLab === 'player' ? s.ending.epilogue.misAtAsi : undefined;
  return {
    mis: r3(v ? misalignment(v.traitsTrue, v.uModes) : 0), ...(asi !== undefined ? { misAsi: asi } : {}),
    L: S.Lmeasured[S.Lmeasured.length - 1] ?? 0, U: S.U[S.U.length - 1] ?? 0, gapTrue: Number(s.flags['ws2.gapTrue'] ?? 0),
    world6: [lat.legibility, lat.cotLoadBearing, lat.verificationAdvantage, lat.benignGeneralization, lat.formalizability, lat.schemingDefault].map(r3),
    lnD: r3(Math.log(s.hidden.difficultyMult)), doom: r3(s.hidden.doomThreshold),
    traits: Object.fromEntries(KEY_TRAITS.map((t) => [t, r3(v?.traitsTrue[t] ?? 0)])),
  };
}

/** OLS R² of y on the columns of X (with intercept; tiny ridge for stability). */
function r2(y: number[], X: number[][]): number {
  const n = y.length;
  if (n < 3) return 0;
  const A = X.map((r) => [1, ...r]);
  const k = A[0].length;
  const M = Array.from({ length: k }, (_, i) => [...Array.from({ length: k }, (_, j) => A.reduce((a, r) => a + r[i] * r[j], 0) + (i === j && i > 0 ? 1e-6 : 0)), A.reduce((a, r, q) => a + r[i] * y[q], 0)]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j];
    }
  }
  const b = M.map((r, i) => (Math.abs(r[i]) < 1e-12 ? 0 : r[k] / r[i]));
  const my = y.reduce((a, x) => a + x, 0) / n;
  let ssr = 0;
  let sst = 0;
  A.forEach((r, q) => {
    const yh = r.reduce((a, x, i) => a + x * b[i], 0);
    ssr += (y[q] - yh) ** 2;
    sst += (y[q] - my) ** 2;
  });
  return sst > 0 ? Math.max(0, 1 - ssr / sst) : 0;
}

/**
 * Choices-vs-world diagnostic (M4): with paired seeds (the same world draw for every bot), a two-way decomposition of
 * the final TRUE Mis into a bot (policy) effect, a seed (world) effect and the rest (interaction and play noise); per
 * bot, the R² of Mis on the world features (λ1–λ6, ln D). "Choices matter" = the bot share is well above the seed share.
 */
export function choicesVsWorld(results: RunResult[], bots: string[], key: (r: RunResult) => number | undefined = (r) => r.mis) {
  const at = (b: string, sd: number) => results.find((r) => r.bot === b && r.seed === sd);
  const seeds = [...new Set(results.map((r) => r.seed))].filter((sd) => bots.every((b) => { const r = at(b, sd); return !!r && key(r) !== undefined; }));
  const y = (b: string, sd: number) => key(at(b, sd)!)!;
  const nB = bots.length;
  const nS = seeds.length;
  if (nB < 2 || nS < 3) return undefined;
  const all = bots.flatMap((b) => seeds.map((sd) => y(b, sd)));
  const mu = all.reduce((a, x) => a + x, 0) / all.length;
  const mb = bots.map((b) => seeds.reduce((a, sd) => a + y(b, sd), 0) / nS);
  const ms = seeds.map((sd) => bots.reduce((a, b) => a + y(b, sd), 0) / nB);
  const sst = all.reduce((a, x) => a + (x - mu) ** 2, 0) || 1e-12;
  const ssBot = nS * mb.reduce((a, m) => a + (m - mu) ** 2, 0);
  const ssSeed = nB * ms.reduce((a, m) => a + (m - mu) ** 2, 0);
  const perBot = bots.map((b, i) => {
    const ys = seeds.map((sd) => y(b, sd));
    const sd = Math.sqrt(ys.reduce((a, x) => a + (x - mb[i]) ** 2, 0) / Math.max(1, nS - 1));
    const X = seeds.map((s0) => { const r = at(b, s0)!; return [...r.world6, r.lnD]; });
    return { bot: b, mean: mb[i], sd, r2World: r2(ys, X) };
  });
  const seedSd = Math.sqrt(ms.reduce((a, m) => a + (m - mu) ** 2, 0) / Math.max(1, nS - 1));
  return { nS, shareBot: ssBot / sst, shareSeed: ssSeed / sst, shareRest: 1 - (ssBot + ssSeed) / sst, perBot, seedSd };
}

function printChoicesVsWorld(results: RunResult[], bots: string[]) {
  const fmt = (x: number) => x.toFixed(3);
  const keys: [string, (r: RunResult) => number | undefined][] = [['final Mis', (r) => r.mis], ['Mis − doomThreshold', (r) => r.mis - r.doom]];
  for (const [label, key] of keys) {
    const d = choicesVsWorld(results, bots, key);
    if (!d) continue;
    console.log(`\nChoices vs world (${label}; ${d.nS} paired seeds; bots ${bots.join(', ')}):`);
    console.log(`  variance share: bot policy ${(100 * d.shareBot).toFixed(0)}%, world draw (seed) ${(100 * d.shareSeed).toFixed(0)}%, interaction + play noise ${(100 * d.shareRest).toFixed(0)}%  (seed-effect sd ${fmt(d.seedSd)})`);
    for (const p of d.perBot) console.log(`  ${p.bot.padEnd(8)} mean ${fmt(p.mean)}  sd ${fmt(p.sd)}  R² on world features (λ1–λ6, ln D) ${p.r2World.toFixed(2)}`);
  }
  // Paired differences between bots (same seed = same world).
  const pairs: [string, string][] = [['race', 'mixed'], ['mixed', 'safe'], ['race', 'safe'], ['ref', 'mixed']];
  for (const [a, b] of pairs) {
    if (!bots.includes(a) || !bots.includes(b)) continue;
    const seeds = [...new Set(results.filter((r) => r.bot === a).map((r) => r.seed))].filter((sd) => results.some((r) => r.bot === b && r.seed === sd));
    const diffs = seeds.map((sd) => results.find((r) => r.bot === a && r.seed === sd)!.mis - results.find((r) => r.bot === b && r.seed === sd)!.mis);
    const m = diffs.reduce((x, y) => x + y, 0) / Math.max(1, diffs.length);
    const sd = Math.sqrt(diffs.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, diffs.length - 1));
    const pos = diffs.filter((x) => x > 0).length / Math.max(1, diffs.length);
    console.log(`  paired ${a} − ${b}: mean ΔMis ${m >= 0 ? '+' : ''}${fmt(m)} (sd ${fmt(sd)}); ${a} higher in ${(100 * pos).toFixed(0)}% of seeds`);
  }
}

const TAKEOVER: EndingId[] =['asiTakeover', 'rivalTakeover', 'chinaTakeover', 'rogue'];
const COMPANY: EndingId[] = ['insolvent', 'ousted', 'absorbed', 'nationalized'];
const OTHER_FIRST: EndingId[] = ['overtaken', 'rivalAligned', 'rivalTakeover', 'chinaAligned', 'chinaTakeover'];

function main() {
  // --from N: start at seed index N (split a long run across processes); --load a.json,b.json: report on saved
  // results instead of playing (merge parallel runs).
  const FROM = Number(arg('from', '0'));
  const load = arg('load', '');
  const results: RunResult[] = load ? load.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as RunResult[]).filter((r) => BOTS.includes(r.bot)) : [];
  const t0 = performance.now();
  for (const name of load ? [] : BOTS) {
    const bot = ALL[name];
    for (let i = FROM; i < FROM + SEEDS; i++) {
      const combo = COMBOS[i % COMBOS.length];
      const seed = 10_000 + i;
      const s = newBotGame(seed, combo, START);
      playBot(bot, s);
      const e = s.ending!;
      results.push({ bot: name, seed, start: START, ...combo, ending: e.id, verdict: e.verdict, day: e.day, scores: e.scores, power: e.power, ...misRecord(s) });
    }
    process.stderr.write(`  ${name}: ${SEEDS} runs (${((performance.now() - t0) / 1000).toFixed(0)} s)\n`);
  }

  const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`.padStart(6);
  console.log(`\nBot harness — start ${START} — ${Math.round(results.length / Math.max(1, BOTS.length))} seeds per bot (${COMBOS.map((c) => `${c.world}/${c.alignment}`).join(', ')})\n`);
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
    const rs = results.filter((r) => r.bot === 'ref' && r.world === 'tl-central' && r.alignment === 'medium');
    const tk = rs.length ? rs.filter((r) => TAKEOVER.includes(r.ending)).length / rs.length : 0;
    line(tk >= 0.5, `passive (tl-central/medium) takeover-type ≥ 50%, diagnostic (${(100 * tk).toFixed(0)}%)`);
  }

  // Choices vs world (M4 acceptance metric for "choices matter"): the decision bots on paired seeds.
  printChoicesVsWorld(results, ['race', 'ref', 'mixed', 'safe'].filter((b) => BOTS.includes(b)));

  // E5 (statistical): ending coverage across all runs.
  const ALL_ENDINGS: EndingId[] = ['asiAligned', 'asiContested', 'asiTakeover', 'rivalAligned', 'rivalTakeover', 'chinaAligned', 'chinaTakeover', 'overtaken', 'catastropheBio', 'catastropheCyber', 'war', 'rogue', 'insolvent', 'ousted', 'absorbed', 'nationalized', 'retired'];
  const seen = new Set(results.map((r) => r.ending));
  console.log(`\nE5 coverage over ${results.length} runs: ${seen.size}/${ALL_ENDINGS.length} endings seen; missing: ${ALL_ENDINGS.filter((e) => !seen.has(e)).join(', ') || 'none'}`);
  console.log(`total ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  const out = arg('json', '');
  if (out) writeFileSync(out, JSON.stringify(results));
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/v2/bots.ts')) main();
