// F1 / F2 test: diffusion of know-how only (design/bal/NPC-FIX.md). Direct calls on a fresh state (tl-central, leader start, no
// simulation): the diffused level D relaxes toward the public know-how P at 1/τ and lifts the effective recipe max(own, D); own
// research past D gets no double count; a leader at or above P (and a player tracking the reference beside a lab on the reference
// path) gets ~0; the C4 tacit leak raises D, not own; an NPC lab's know-how has no compute term.
// Run: npx tsx scripts/v2/diffusion.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { DIFFUSION_TAU_DAYS } from '../../src/data/v2/calibration';
import { diffusionPerDay } from '../../src/engine/v2/production/production';
import { addIdea, diffusedLift, ePreAt, ownKnowhowG, playerRecipeG, raiseDiffused, RECIPE_F, researchG, startRecipeG } from '../../src/engine/v2/models/stacks';
import { persOf } from '../../src/engine/v2/npc/lab';
import { refS } from '../../src/engine/v2/npc/reference';
import * as sh from '../../src/engine/v2/npc/shocks';
import { SERIES_ANCHOR } from '../../src/data/v2/timelineSeries';
import { decimalYear } from '../../src/engine/v2/core/time';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const base = newGame(defaultSetupV2({ world: 'tl-central', labKind: 'leader', seed: 7, tutorial: false }));
const npcs = (s: GameStateV2): RivalLab[] => [...s.rivals, s.china.lab].filter((r) => r.core.status === 'active' && r.npc);
const f = (x: number) => x.toFixed(4);
const pubLag = (r: RivalLab) => persOf(r.npc).releaseLagDays;

// Alignment: a lab on the reference path at the player's start position has the player's start recipe.
{
  const s = clone(base);
  const pos0 = sh.playerPos(s)!;
  check(near(sh.knowhowAt(s, decimalYear(s) - pos0 / 365.25), startRecipeG(s), 1e-6) && near(sh.playerKnowhowPos(s)!, pos0, 1e-6),
    'alignment: know-how at the player\'s start position = its start recipe; its know-how position = its capability position',
    `start position ${pos0.toFixed(1)} d, start recipe ${f(startRecipeG(s))}, D0 ${f(s.player.research.diffused)}`);
}

// (a) a player behind P: D steps (P − D)/τ toward P and the effective recipe rises (models train on it); own does not move.
{
  const s = clone(base);
  const r = npcs(s)[0]; r.npc.d = -300 - pubLag(r); // its public know-how 300 d ahead of the reference
  const own0 = ownKnowhowG(s), D0 = s.player.research.diffused, eff0 = playerRecipeG(s), pre0 = ePreAt(s, 1e27), rg0 = researchG(s, RECIPE_F);
  const pd = diffusionPerDay(s);
  const { P } = sh.publicKnowhow(s);
  raiseDiffused(s, undefined, pd.D, 'test');
  const step = s.player.research.diffused - D0;
  const rise = playerRecipeG(s) - eff0;
  check(P > own0 && near(step, (P - D0) / DIFFUSION_TAU_DAYS) && rise > 0 && near(rise, Math.max(own0, s.player.research.diffused) - Math.max(own0, D0)) && near(pd.dG, rise),
    '(a) behind P: D gains (P − D)/τ in a day and the effective recipe rises by what lifts max(own, D)',
    `P ${f(P)}, own ${f(own0)}, D ${f(D0)} -> ${f(s.player.research.diffused)} (step ${step.toExponential(3)} = gap/τ ${((P - D0) / DIFFUSION_TAU_DAYS).toExponential(3)}), effective +${rise.toExponential(3)}`);
  check(near(ePreAt(s, 1e27) - pre0, rise) && near(ownKnowhowG(s), own0) && near(researchG(s, RECIPE_F), rg0),
    '(a) the lift reaches the pretraining recipe a run trains with (ePreAt); own know-how and researchG do not move');
  // a year of steps at a fixed P: D closes 1 − e^(−365/τ) of the gap
  const t = clone(s); for (let i = 0; i < 365; i++) raiseDiffused(t, undefined, diffusionPerDay(t).D, 'test');
  const closed = (t.player.research.diffused - D0) / (P - D0);
  check(Math.abs(closed - (1 - Math.pow(1 - 1 / DIFFUSION_TAU_DAYS, 366))) < 1e-9, '(a) a year at a fixed P closes 1 − (1 − 1/τ)^days of the gap', `${(closed * 100).toFixed(1)}%`);
}

// (b) once own overtakes D, the effective recipe is own (no double count).
{
  const s = clone(base);
  s.player.research.diffused = ownKnowhowG(s) + 0.2; // D 0.2 above own
  const eff0 = playerRecipeG(s);
  check(near(eff0, ownKnowhowG(s) + 0.2, 1e-9) && near(diffusedLift(s), 0.2), '(b) D above own: effective = D', `effective ${f(eff0)}`);
  addIdea(s.player.research.stacks.pre, 0.5, 0, RECIPE_F); // own research of 0.5 OOM
  const eff1 = playerRecipeG(s);
  check(diffusedLift(s) === 0 && near(eff1, ownKnowhowG(s)) && near(eff1 - eff0, 0.3, 1e-9),
    '(b) own research past D: effective = own, the gain is 0.5 − 0.2 (not 0.5 on top of D)', `effective ${f(eff0)} -> ${f(eff1)}`);
}

// (c) a leader at or above P gets ~0; a lab exactly on the reference path at the player's position gives a player tracking the reference ~0.
{
  const s = clone(base);
  const { P } = sh.publicKnowhow(s);
  const pd = diffusionPerDay(s);
  check(P <= ownKnowhowG(s) + 1e-9 && pd.dG === 0, '(c) the day-0 leader (every NPC lab behind it) gets 0', `P ${f(P)} (${pd.from}), own ${f(ownKnowhowG(s))}`);
  // a year in: the player's own research tracked the reference software path from its start position; one NPC lab sits on the
  // reference path at the player's position (its public position = the player's), the rest far behind
  const t = clone(base);
  t.time.day = 365;
  const pos0 = sh.playerPos(base)!;
  const y = decimalYear(t) - pos0 / 365.25;
  addIdea(t.player.research.stacks.pre, (refS(t, y) ?? 0) - (refS(t, SERIES_ANCHOR) ?? 0), 0, RECIPE_F);
  const labs = npcs(t);
  labs.forEach((r, i) => { r.npc.d = i === 0 ? pos0 - pubLag(r) : 400; });
  t.player.research.diffused = ownKnowhowG(t); // D has kept up with P = own (the hardest case for a spurious inflow)
  const q = sh.publicKnowhow(t);
  const pq = diffusionPerDay(t);
  check(Math.abs(q.P - ownKnowhowG(t)) < 1e-6 && Math.abs(pq.dG) < 1e-8, '(c) on the reference path beside a player that tracks it: P = own, ~0 net inflow',
    `P − own ${(q.P - ownKnowhowG(t)).toExponential(2)}, inflow ${pq.dG.toExponential(2)}/day`);
  // a lab ahead of the reference path does give it an inflow (the rule is not just off)
  labs[0].npc.d = pos0 - pubLag(labs[0]) - 90;
  check(diffusionPerDay(t).dG > 0, '(c) the same lab 90 d further ahead: a positive inflow');
}

// (d) a poach raises D, not own; the effective recipe rises by the preview's tacit gain.
{
  const s = clone(base);
  const r = s.rivals.find((x) => x.core.status === 'active')!; r.npc.d = -200; r.core.staff.cap = 4000;
  const heads = Math.max(5, Math.round(r.core.staff.cap * 0.03));
  const gain = sh.tacitKnowhowGain(s, r, heads);
  const own0 = ownKnowhowG(s), D0 = s.player.research.diffused, eff0 = playerRecipeG(s), rg0 = researchG(s, RECIPE_F);
  const err = act(s, 'C4', { lab: r.core.id });
  check(!err && gain > 0 && near(ownKnowhowG(s), own0) && near(researchG(s, RECIPE_F), rg0) && s.player.research.diffused > D0 && near(playerRecipeG(s) - eff0, gain, 1e-9),
    '(d) C4 poach: D rises, own and researchG do not; the effective recipe rises by the tacit gain', `gain ${f(gain)}, D ${f(D0)} -> ${f(s.player.research.diffused)}, err ${err ?? '-'}`);
  // a second poach right after: the gain is a share of the remaining gap, no double count
  const g2 = sh.tacitKnowhowGain(s, r, heads);
  check(g2 < gain, '(d) a second poach finds a smaller gap', `${f(g2)} < ${f(gain)}`);
}

// (e) doubling an NPC lab's compute leaves its know-how unchanged.
{
  const s = clone(base);
  const r = npcs(s)[0];
  const k0 = sh.npcKnowhow(s, r), ki0 = sh.npcKnowhow(s, r, true), P0 = sh.publicKnowhow(s).P;
  r.core.computeOnline *= 2;
  check(sh.npcKnowhow(s, r) === k0 && sh.npcKnowhow(s, r, true) === ki0 && sh.publicKnowhow(s).P === P0, '(e) doubling an NPC lab\'s compute: its know-how (public and internal) and P unchanged', `${r.core.name} ${f(k0)}`);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
