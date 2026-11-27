// L4 (LABOUR-ROUND §7) targeted check (run alone): research lines that open mid-game (P24, Recurrent architectures) start from
// the pretraining research stock: n0 = mean over {L.scale, L.data, L.opt} of (n0_l + pool_l) on the day the line opens,
// stored in tree[id].startPool; linePool reads it; lines without a stored value are unchanged; rivals use the mean start pool.
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { linePool, linePoolAt } from '../../src/engine/v2/models/research';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { LINE_FIT, MID_GAME_LINES, PRETRAIN_START_LINES } from '../../src/data/v2/research';
import { tick } from '../../src/engine/v2/core/loop';
import { check, finish, runRef } from './lib';
import type { GameStateV2 } from '../../src/engine/v2/types';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1e-12, Math.abs(b));
const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false, leaderLab: true }));
s.player.finance.cash = 1e6;
const trio = PRETRAIN_START_LINES.map((id) => TREE_BY_ID[id]!);
const stockOf = (x: GameStateV2) => trio.map((l) => linePool(x, l).n0 + (x.player.tree[l.id]?.cap?.pool ?? 0));
const mean = (a: number[]) => a.reduce((p, c) => p + c, 0) / a.length;
const know = (x: GameStateV2, id: string) => { x.player.tree[id] = { ...(x.player.tree[id] ?? {}), status: 'known', progress: 1, day: x.time.day }; };

// Baselines before anything opens.
const p24 = TREE_BY_ID['P24']!, latent = TREE_BY_ID['L.latent']!;
// The old rule: a fresh pool, n0 from the line's first idea (mean x LINE_FIT.mu at returns r_l): 1 / (10^(mu1/r) - 1).
const oldFresh = (n: typeof p24) => { const r = (n.effect?.rShare ?? 0.1) * s.hidden.timeline.v3.r; return 1 / (Math.pow(10, ((n.effect?.mean ?? 0) * LINE_FIT.mu) / r) - 1); };
const fresh24 = oldFresh(p24), freshLatent = oldFresh(latent);
const before = trio.map((l) => linePool(s, l));
console.log(`fresh (unopened) n0: P24 ${fresh24.toFixed(3)}, L.latent ${freshLatent.toFixed(3)}; start pools ${before.map((b) => b.n0.toFixed(2)).join(', ')}`);

// Run the reference lab so the pretraining lines accumulate research.
runRef(s, 330);
const pools1 = stockOf(s);
check(pools1.some((v, i) => v > before[i].n0 + 1e-9), 'the pretraining lines gained research since the start', pools1.map((v) => v.toFixed(2)).join(', '));
check(s.player.tree['P24']?.startPool === undefined && s.player.tree['L.latent']?.startPool === undefined, 'nothing stored before the lines open');

// Open P24: its prerequisite becomes known; the next day's research step stores the start pool.
const expected24 = mean(stockOf(s));
for (const need of p24.needs) know(s, need);
tick(s, { skip: ['endings'] });
const st24 = s.player.tree['P24']?.startPool;
check(st24 !== undefined && near(st24, expected24, 1e-6), 'P24: stored n0 = mean of the three pretraining pools that day', `stored ${st24?.toFixed(3)} vs expected ${expected24.toFixed(3)}; fresh pool was ${fresh24.toFixed(3)}`);
check(near(linePool(s, p24).n0, st24 ?? NaN, 1e-12) && linePool(s, p24).n0 > 10 * fresh24, 'P24: linePool returns the stored n0, not the fresh pool', `n0 ${linePool(s, p24).n0.toFixed(3)} vs fresh ${fresh24.toFixed(3)}`);
check(near(linePool(s, p24).r, 0.3 * s.hidden.timeline.v3.r, 1e-12), 'P24: returns r unchanged');
check(s.player.tree['L.latent']?.startPool === undefined, 'L.latent still closed: nothing stored');

// A day later it does not change (stored once), though the pools move.
runRef(s, s.time.day + 20);
check(s.player.tree['P24']?.startPool === st24, 'P24: n0 is stored once (unchanged 20 days later)');

// Open L.latent (P17 known) on a later day: n0 from that day's pools.
const expectedL = mean(stockOf(s));
for (const need of latent.needs) know(s, need);
tick(s, { skip: ['endings'] });
const stL = s.player.tree['L.latent']?.startPool;
check(stL !== undefined && near(stL, expectedL, 1e-6), 'L.latent: stored n0 = mean of the three pretraining pools that day', `stored ${stL?.toFixed(3)} vs expected ${expectedL.toFixed(3)}; fresh pool was ${freshLatent.toFixed(3)}`);
check(near(linePool(s, latent).n0, stL ?? NaN, 1e-12) && !near(linePool(s, latent).n0, freshLatent, 1e-6), 'L.latent: linePool returns the stored n0, not the old fresh pool', `n0 ${linePool(s, latent).n0.toFixed(3)} vs old fresh ${freshLatent.toFixed(3)}`);
check(stL !== undefined && st24 !== undefined && stL > st24, 'later opening, larger stock (L.latent n0 > P24 n0)', `${stL?.toFixed(2)} > ${st24?.toFixed(2)}`);

// Lines without a stored value are unchanged: the pretraining lines keep their start pools; startPool never set on them.
check(trio.every((l, i) => near(linePool(s, l).n0, before[i].n0, 1e-12) && s.player.tree[l.id]?.startPool === undefined), 'L.scale / L.data / L.opt: linePool n0 unchanged, nothing stored');
const other = ['L.env', 'L.rlalg', 'L.infer'].map((id) => TREE_BY_ID[id]!);
check(other.every((l) => s.player.tree[l.id]?.startPool === undefined), 'other lines: nothing stored');

// Rivals (stateless): the mean start pool of the three lines (linePoolAt, fresh recipe).
const r = s.hidden.timeline.v3.r;
const rivalMean = mean(trio.map((l) => linePoolAt(r, l).n0));
check(MID_GAME_LINES.every((id) => near(linePoolAt(r, TREE_BY_ID[id]!).n0, rivalMean, 1e-12)), 'rivals: linePoolAt of a mid-game line = mean start pool of the three', `${rivalMean.toFixed(3)}`);
check(trio.every((l) => near(linePoolAt(r, l).n0, oldFresh(l), 1e-12)), 'rivals: the three lines keep their own linePoolAt (fresh first-idea n0)');

finish('linestart');
