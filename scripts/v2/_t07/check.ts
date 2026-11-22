// RD-T07 targeted check (DD-07): fidelity = f(live tasks × grader quality); start suites at fidelity 1 and the old
// exploitability; tasks go stale without upkeep (half-life SUITE_DECAY) and met upkeep holds them; S2 follows
// exploitability through the one stated formula; a rev-65 save gets its suites' tasks from their expert data.
import { EXPLOIT_START, S2_PER_EXPLOIT, START_TASKS, SUITE_DECAY } from '../../../src/data/v2/suites';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { buildSystem } from '../../../src/engine/v2/departments/build';
import {
  START_SUITE_FAMILIES, completeSuiteWork, decaySuites, fidelityOf, suiteExploitMap, suiteFidelity, suiteOf, suiteRlWeights, suiteS2, suitesView, suiteExpertT,
} from '../../../src/engine/v2/models/suites';
import type { StartType } from '../../../src/engine/v2/types';
import { check, finish } from '../lib';

const game = (start: StartType = 'leader') => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, start, tutorial: false }));
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
// Pre-RD-T07 start values: cheap 0.15 / 0.45 / 0.025 / 0.3 × 0.4 (leader); spinout × 2.5.
const OLD_START = { math: 0.06, swe: 0.18, mlResearch: 0.12, longHorizon: 0.01, cyber: 0.01, bio: 0.01 } as const;

for (const st of ['leader', 'spinout'] as StartType[]) {
  const s = game(st);
  const m = st === 'spinout' ? 2.5 : 1;
  const fids = START_SUITE_FAMILIES.map((f) => suiteFidelity(s, f));
  const xs = START_SUITE_FAMILIES.map((f) => suiteOf(s, f)!.exploit);
  check(fids.every((x) => near(x, 1, 1e-9)) && START_SUITE_FAMILIES.every((f, i) => near(xs[i], OLD_START[f as keyof typeof OLD_START] * m, 1e-12)) && START_SUITE_FAMILIES.every((f) => near(suiteOf(s, f)!.tasks, START_TASKS, 1e-6)),
    `${st}: start suites at fidelity 1, 100k tasks, the old exploitability`, xs.map((x) => x.toFixed(3)).join(' '));
}

// Decay: zero upkeep for one half-life halves the tasks; met upkeep holds them.
const half = SUITE_DECAY.halfLifeMonths * SUITE_DECAY.daysPerMonth;
const d = game();
decaySuites(d, 0, half);
check(near(suiteOf(d, 'swe')!.tasks, START_TASKS / 2, 1e-6) && near(suiteFidelity(d, 'swe'), fidelityOf(START_TASKS / 2), 1e-12) && suiteFidelity(d, 'swe') < 0.8,
  'no upkeep for a half-life: half the tasks, fidelity falls', `fid ${suiteFidelity(d, 'swe').toFixed(3)}`);
const h = game();
decaySuites(h, 1, 365);
decaySuites(h, 0.5, half);
check(near(suiteFidelity(game(), 'swe'), 1) && near(suiteOf(h, 'swe')!.tasks, START_TASKS * Math.SQRT1_2, 1e-6), 'met upkeep holds the tasks; half the upkeep decays at half the rate', `${suiteOf(h, 'swe')!.tasks.toFixed(0)}`);

// Through the build system: 60 days with the upkeep need served vs capped at 0.
const run = (cap0: boolean) => {
  const s = game();
  if (cap0) s.player.build.alloc = { ...s.player.build.alloc, max: { ...s.player.build.alloc.max, upkeep: 0 } };
  for (let i = 0; i < 60; i++) { s.time.day++; buildSystem.run(s, makeCtx(s)); }
  return s;
};
const held = run(false);
const starved = run(true);
check(near(suiteFidelity(held, 'math'), 1, 1e-9) && suiteFidelity(starved, 'math') < 0.99 && near(suiteOf(starved, 'math')!.tasks, START_TASKS * Math.pow(0.5, 60 / half), 1e-3),
  'build system: upkeep served holds fidelity, upkeep starved decays it', `held ${suiteFidelity(held, 'math').toFixed(4)} · starved ${suiteFidelity(starved, 'math').toFixed(4)}`);

// A build adds tasks; hardening raises grader quality (fidelity) and cuts exploitability.
const b = game();
completeSuiteWork(b, makeCtx(b), 'swe:build');
const k = game();
completeSuiteWork(k, makeCtx(k), 'swe:harden');
check(near(suiteOf(b, 'swe')!.tasks, 2 * START_TASKS, 1e-6) && near(suiteFidelity(b, 'swe'), fidelityOf(2 * START_TASKS), 1e-12)
  && suiteOf(k, 'swe')!.exploit < OLD_START.swe && suiteFidelity(k, 'swe') > 1,
  'a build doubles a start suite\'s tasks; hardening cuts exploitability and raises fidelity', `build ${suiteFidelity(b, 'swe').toFixed(3)} · harden ${suiteFidelity(k, 'swe').toFixed(3)}`);

// S2 = S2_PER_EXPLOIT · Σ share · x, and it moves with exploitability.
const s2s = game();
const w = suiteRlWeights(s2s, 'broad');
const s20 = suiteS2(w, suiteExploitMap(s2s));
const sum0 = Object.entries(w).reduce((a, [f, wf]) => a + wf * EXPLOIT_START[f as keyof typeof EXPLOIT_START], 0);
s2s.player.suites.swe = { ...suiteOf(s2s, 'swe')!, exploit: 0.36 };
const s21 = suiteS2(w, suiteExploitMap(s2s));
check(S2_PER_EXPLOIT === 5.5 && near(s20, 5.5 * sum0) && near(s21 - s20, 5.5 * (w.swe ?? 0) * (0.36 - 0.18), 1e-12) && near(suitesView(s2s).s2, s21),
  'S2 = 5.5 × Σ RL share × exploitability, following exploitability', `${s20.toFixed(4)} → ${s21.toFixed(4)}`);

// Migration 65 → 66: tasks from the suite's expert data.
const mg = game();
completeSuiteWork(mg, makeCtx(mg), 'math:build');
const raw = JSON.parse(JSON.stringify(mg));
raw.schemaRev = 65;
for (const x of Object.values(raw.player.suites) as { tasks?: number }[]) delete x.tasks;
const g = deserialize(JSON.stringify(raw));
check(near(suiteOf(g, 'math')!.tasks, 2 * START_TASKS, 1e-6) && near(suiteFidelity(g, 'math'), suiteFidelity(mg, 'math'), 1e-12) && near(suiteExpertT(g, 'math'), suiteExpertT(mg, 'math')),
  'migration 65 → 66: a suite\'s live tasks come from its expert data', `${suiteOf(g, 'math')!.tasks}`);

finish('rdt07');
