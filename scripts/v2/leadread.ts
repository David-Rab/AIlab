// F7 (design/bal/NPC-FIX.md): the lead readouts compare like with like. Replays the forced central game (seed 2027, reflines
// bot, AIFM-forced compute and staff) to 2027.0 and prints the player's lead over each NPC lab monthly, on the OLD clock
// (the player's best internal version against each lab's internal G, series.G) and the NEW one (the latest public model of
// each, both stepped, series.GP). PASS/FAIL, exit 1 on failure:
//   (1) the replica of the lead clock on the weekly series agrees with the engine's lagDays at the end of the run;
//   (2) whenever the player's latest public model is ahead of every NPC lab's public model, no lab shows it trailing;
//   (3) the readout the player sees (leadDays) is the public lead plus the report error, not the old internal clock.
// Run: npx tsx scripts/v2/leadread.ts
import { installForced } from './forcedInputs';
installForced('aifm');
const B = await import('./botgame');
const { lagDays } = await import('../../src/engine/v2/models/capability');
const { publicG, otherLabs } = await import('../../src/engine/v2/models/labs');
const { PRE_GAME_G_PER_YEAR } = await import('../../src/data/v2/runDesign');
const { leadDays } = await import('../../src/engine/v2/actors/intel');
const { publicOf } = await import('../../src/engine/v2/npc/public');
const { decimalYear } = await import('../../src/engine/v2/core/time');

const UNTIL = 2027.0;
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); };

const s = B.newBotGame(2027, { world: 'tl-central', alignment: 'medium' }, 'leader');
B.playForced(B.ALL['reflines'], s, UNTIL, { spdM: false });

// Replica of capability.ts lagDays / daysSinceG on a weekly series (`xs` aligned to `days` from the end): the lab's line runs
// through the corners (first sample at each new record), closed by today's value. `n` samples are visible, `gNow` today's G.
type Line = { xs: number[]; days: number[] };
const line = (ser: Record<string, number[]>, days: number[], id: string, n: number): Line => {
  const all = ser[id] ?? [];
  const off = Math.max(0, days.length - all.length);
  const xs = all.slice(0, Math.max(0, n - off));
  return { xs, days: days.slice(off, off + xs.length) };
};
function daysSince(l: Line, g: number, gNow: number, today: number): number {
  const { xs, days } = l;
  const rate = PRE_GAME_G_PER_YEAR;
  if (!xs.length) return ((gNow - g) / rate) * 365;
  if (g < xs[0]) return Math.max(0, today - days[0]) + ((xs[0] - g) / rate) * 365;
  let pd = days[0], px = xs[0];
  if (g <= px) return Math.max(0, today - pd);
  const at = (d: number, x: number) => today - (pd + ((g - px) / Math.max(1e-12, x - px)) * (d - pd));
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (x <= px) continue;
    if (x >= g) return Math.max(0, at(days[i], x));
    pd = days[i]; px = x;
  }
  if (gNow > px && today > pd) return Math.max(0, at(today, gNow));
  return 0;
}
/** Player's lead over `lab` (days, > 0 = ahead) from the two labs' series and today's values. */
function lead(fL: Line, gF: number, lL: Line, gL: number, today: number): number {
  if (!Number.isFinite(gF) || !Number.isFinite(gL)) return 0;
  // lagDays(lab, player): the follower is the lab, the leader the player.
  return gL >= gF ? daysSince(lL, gF, gL, today) : -daysSince(fL, gL, gF, today);
}

const days = s.series.day;
const ids = otherLabs(s).filter((r) => r.core.status === 'active').map((r) => r.core.id);
const name = (id: string) => otherLabs(s).find((r) => r.core.id === id)?.core.name ?? id;
const last = (a: number[] | undefined) => (a && a.length ? a[a.length - 1] : -Infinity);

// Monthly table (every 4th weekly sample).
const head = ['year', 'pub G', ...ids.map((i) => name(i).slice(0, 9))];
console.log('\nPlayer lead in days, old internal clock / new public clock (negative = shown trailing):');
console.log(head.map((h) => h.padEnd(13)).join(''));
let wrongBefore = 0, wrongAfter = 0, aheadWeeks = 0;
for (let i = 0; i < days.length; i++) {
  const day = days[i];
  const gpPlayer = s.series.GP.player ? line(s.series.GP, days, 'player', i + 1) : { xs: [], days: [] };
  const pubP = last(gpPlayer.xs);
  const pubBest = Math.max(...ids.map((id) => last(line(s.series.GP, days, id, i + 1).xs)));
  const cells: string[] = [];
  let trailOld = false, trailNew = false;
  for (const id of ids) {
    const oldV = lead(line(s.series.G, days, id, i + 1), last(line(s.series.G, days, id, i + 1).xs), line(s.series.G, days, 'player', i + 1), last(line(s.series.G, days, 'player', i + 1).xs), day);
    const pl = line(s.series.GP, days, id, i + 1);
    const newV = lead(pl, last(pl.xs), gpPlayer, pubP, day);
    cells.push(`${Math.round(oldV)}/${Math.round(newV)}`);
    if (oldV < 0) trailOld = true;
    if (newV < 0) trailNew = true;
  }
  if (Number.isFinite(pubP) && pubP > pubBest) {
    aheadWeeks++;
    if (trailOld) wrongBefore++;
    if (trailNew) wrongAfter++;
  }
  if (i % 4 === 0) console.log([(2025.5 + day / 365.25).toFixed(2), Number.isFinite(pubP) ? pubP.toFixed(2) : 'none', ...cells].map((c) => String(c).padEnd(13)).join(''));
}
console.log('');
check(aheadWeeks > 0, 'the run has weeks where the player leads on public models', `${aheadWeeks} of ${days.length} weeks`);
console.log(`      weeks the player leads on public models but a lab shows ahead of it: old clock ${wrongBefore}, new clock ${wrongAfter}`);
check(wrongAfter === 0, 'a player ahead on public models is never shown trailing', `${wrongAfter} weeks`);

// (1) the replica agrees with the engine at the end of the run.
const today = s.time.day;
for (const id of ids) {
  const eng = lagDays(s, id, 'player');
  const gp = (x: string) => line(s.series.GP, days, x, days.length);
  const rep = lead(gp(id), publicG(s, id), gp('player'), publicG(s, 'player'), today);
  check(Math.abs(eng - rep) < 1e-6, `engine lagDays(${name(id)}, player) = the replica`, `${eng.toFixed(1)} vs ${rep.toFixed(1)} d`);
}

// (2) at the end: the engine's own lead on the public models is not negative when the player's public model is ahead of all.
const pubEnd = publicG(s, 'player');
const bestNpc = Math.max(...ids.map((id) => publicG(s, id)));
if (pubEnd > bestNpc) for (const id of ids) check(lagDays(s, id, 'player') >= 0, `at ${decimalYear(s).toFixed(2)} the player leads ${name(id)} on public models`, `${lagDays(s, id, 'player').toFixed(0)} d`);

// (3) the player's readout is built on that lead (not on the internal clock).
for (const id of ids) {
  const r = otherLabs(s).find((x) => x.core.id === id)!;
  const want = Math.round(lagDays(s, id, 'player') - (r.npc?.d ?? 0) + (r.npc ? publicOf(s, r).lagDays : 0));
  check(leadDays(s, id).est === want, `leadDays(${name(id)}) = public lead + report error`, `${leadDays(s, id).est} d`);
}

console.log(fails ? `\nFAIL (${fails})` : '\nPASS');
process.exit(fails ? 1 : 0);
