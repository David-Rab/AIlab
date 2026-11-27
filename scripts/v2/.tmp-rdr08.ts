// RD-R08 targeted check: a line's expected flow (φ = 1) vs the explicit pipeline (φ = 0) at the same mid inputs:
// OOM per day (the pool's r·log₁₀ growth) and ideas adopted per day; plus the half-and-half day (φ = 0.5).
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { TREE } from '../../src/data/v2/tree';
import { PACE_BATCH } from '../../src/data/v2/research';
import { capState, isCapProject, linePool, researchInputs, stepProject, projectFlopPerDay } from '../../src/engine/v2/models/research';
import type { GameStateV2, SystemCtx } from '../../src/engine/v2/types';

const DAYS = 1500;
const line = TREE.find((n) => n.kind === 'line' && isCapProject(n) && n.effect?.stack === 'pre') ?? TREE.find((n) => n.kind === 'line' && isCapProject(n))!;

function run(seed: number, X: number, capScale: number) {
  const s: GameStateV2 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed, tutorial: false }));
  const sci = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap');
  for (const t of s.player.teams) if (t.projectId === line.id) t.projectId = undefined;
  sci.slice(0, capScale).forEach((t) => (t.projectId = line.id));
  s.player.tree[line.id] = { ...(s.player.tree[line.id] ?? {}), status: 'researching' } as never;
  const st = capState(s, line.id);
  const ctx = { day: 0, log: () => undefined } as unknown as SystemCtx;
  const flop = projectFlopPerDay(s);
  const inp = { ...researchInputs(s, 2, flop), X };
  const pl = linePool(s, line);
  const M0 = pl.n0 + (st.pool ?? 0);
  let ideas = 0;
  let b = 0;
  for (let d = 0; d < DAYS; d++) {
    (ctx as { day: number }).day = d;
    stepProject(s, ctx, line, inp, 1, 2, flop, () => `b${b++}`);
    for (const r of st.pending ?? []) ideas += r.flow ? r.flow.n : r.c.b;
    delete st.pending;
  }
  const oom = pl.r * Math.log10((pl.n0 + (st.pool ?? 0)) / M0);
  return { oomDay: oom / DAYS, ideasDay: ideas / DAYS, builds: b };
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
for (const cap of [1, 3]) {
  const avg = (X: number) => {
    const rs = seeds.map((sd) => run(sd, X, cap));
    const m = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
    return { oomDay: m((r) => r.oomDay), ideasDay: m((r) => r.ideasDay), builds: m((r) => r.builds) };
  };
  const ex = avg(1);
  const fl = avg(2 * PACE_BATCH);
  const half = avg(1.5 * PACE_BATCH);
  const rel = (a: number, b: number) => (a - b) / Math.max(1e-12, b);
  console.log(`${line.id} sci teams ${cap}: explicit ${ex.oomDay.toExponential(3)} OOM/d ${ex.ideasDay.toFixed(3)} ideas/d (${ex.builds} builds); flow ${fl.oomDay.toExponential(3)} (${(100 * rel(fl.oomDay, ex.oomDay)).toFixed(1)}%) ${fl.ideasDay.toFixed(3)} ideas/d (${(100 * rel(fl.ideasDay, ex.ideasDay)).toFixed(1)}%); φ=0.5 ${half.oomDay.toExponential(3)} (${(100 * rel(half.oomDay, ex.oomDay)).toFixed(1)}%)`);
  const ok = Math.abs(rel(fl.oomDay, ex.oomDay)) < 0.15 && Math.abs(rel(fl.ideasDay, ex.ideasDay)) < 0.15 && Math.abs(rel(half.oomDay, ex.oomDay)) < 0.15;
  console.log(ok ? 'PASS (tolerance 15%)' : 'FAIL (tolerance 15%)');
}
