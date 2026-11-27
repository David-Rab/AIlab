// RD-X01 targeted check (run alone): one line-rate law for the player's lines and the rivals' recipe parts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { recipeParts, recipeRates } from '../../src/engine/v2/actors/rivalModel';
import { lineRate, linePool, linePoolAt, poolMean, poolAfter } from '../../src/engine/v2/models/research';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { DEFAULT_LINES } from '../../src/data/v2/research';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import { HERE, check, finish, runRef } from './lib';

const mk = () => newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false, leaderLab: true }));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1e-12, Math.abs(b));
const s = mk();
const w = s.hidden.timeline;

// 1. Player: the prior mean and the expected flow's step are lineRate on the line's pool.
const n = TREE_BY_ID[DEFAULT_LINES[0].id]!;
const pl = linePool(s, n);
const R = 3.7, q = 1.3;
check(poolMean(pl, R, q, 1) === lineRate(pl.r, pl.n0 + R, q) && near(poolAfter(pl.r, pl.n0 + R, lineRate(pl.r, pl.n0 + R, q)), pl.n0 + R + q, 1e-12),
  'X01 player line: prior mean = lineRate; pool advance M·10^(x/r) = M + q', `${poolMean(pl, R, q, 1).toFixed(6)}`);

// 2. Rival parts: Σ over the part's default lines of 365·lineRate at one relative research speed; ≈ the old aggregate a_p·rs·10^(−S/r_p).
const P = recipeParts();
const r = w.v3.r;
const ph = { rec: { pre: 0, mid: 0, ceil: 0 }, pool: { pre: 0.4, mid: 0.2, ceil: 0.1 } };
for (const rs of [1, 5]) {
  const x = recipeRates(w, ph, rs);
  const i = (rs * P.pre.a * Math.LN10) / (P.pre.w * r);
  for (const p of ['mid', 'ceil'] as const) {
    const rel = Math.pow(10, ph.pool[p] / (P[p].w * r));
    const sum = P[p].lines.reduce((a, l) => { const lp = linePoolAt(r, l); return a + 365 * lineRate(lp.r, lp.n0 * rel, (i * lp.n0) / 365); }, 0);
    const old = P[p].a * rs * Math.pow(10, -ph.pool[p] / (P[p].w * r));
    check(near(x.pool[p], sum, 1e-12) && near(x.pool[p], old, 1e-2), `X01 rival part ${p} at rs ${rs}: Σ lines lineRate, within 1% of a_p·rs·10^(−S/r_p)`, `${x.pool[p].toFixed(5)} vs old ${old.toFixed(5)} (${(100 * (x.pool[p] / old - 1)).toFixed(3)}%)`);
  }
}

// 3. No copies in rivalModel.ts.
const src = readFileSync(join(HERE, '../../src/engine/v2/actors/rivalModel.ts'), 'utf8');
check(!/S_CLAMP|SURVIVE_FRAC|LINE_STAGES|Math\.pow\(10, -ph\.pool/.test(src), 'X01 rivalModel.ts has no S_CLAMP / SURVIVE_FRAC / LINE_STAGES copy and no own pool law');

// 4. INFO: the leader's recipe pool growth (pretraining part, OOM/yr) on ai2027 at days 100 / 400, new vs old law at its rs.
const g = mk();
const L = () => g.rivals.find((x) => x.core.id === LEADER_ID)!;
for (const day of [100, 400]) {
  runRef(g, day);
  const before = L().phys.pool.pre;
  runRef(g, day + 1);
  const dNew = (L().phys.pool.pre - before) * 365;
  const rp = P.pre.w * g.hidden.timeline.v3.r;
  const u = Math.pow(10, dNew / (365 * rp)) - 1; // new = 365·r_p·log10(1 + u), u = i·10^(−S/r_p)/365
  const dOld = (365 * rp * u) / Math.LN10;
  console.log(`INFO day ${day}: leader pretraining pool growth ${dNew.toFixed(4)} OOM/yr (old law ${dOld.toFixed(4)}, ${(100 * (dNew / dOld - 1)).toFixed(3)}%)`);
}
finish('rdx01');
