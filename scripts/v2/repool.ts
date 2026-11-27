// L5 (design/bal/LABOUR-ROUND.md §3.1): pooled capability research engineers. The pool is m_EXP × the human
// team-equivalents (effective); base needs in the player's order (run operations, then RE_FULL_PROJECT per project in
// experiments, by priority, the last one partial); the surplus spread evenly over the projects in experiments; a project's
// labour is already effective, so ℓ = (re_eff ÷ RE_LABOUR_UNIT)^λ with no second m.
//   npx tsx scripts/v2/repool.ts
// (The one-seed replay, check (e), is a separate run: scripts/v2/balrun.ts --name l5smoke --forced aifm --policy reflines
//  --world tl-central --seeds 1 --workers 1.)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RE_FULL_PROJECT } from '../../src/data/v2/research';
import { PROJECT_BY_ID } from '../../src/data/v2/tree';
import { RE_LABOUR_UNIT, C_UNIT_FLOP_PER_DAY } from '../../src/data/v2/workTypes';
import { TEAM_SIZE } from '../../src/data/v2/teams';
import { deserialize } from '../../src/engine/v2/core/save';
import { workContext } from '../../src/engine/v2/departments/workfit';
import {
  capReCapacity, experimentRate, freshCap, isCapProject, projectExpInputs, reAllocation, reOpsNeed, researchInputs, unitProjectRe,
} from '../../src/engine/v2/models/research';
import { Xces } from '../../src/engine/v2/production/ces';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const N = 12; // projects in experiments
const IDS = Object.values(PROJECT_BY_ID).filter((n) => isCapProject(n)).map((n) => n.id).slice(0, N + 1);
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** The day-400 fixture with `heads` human research-engineer team-equivalents on capabilities (one Strong team), the
 *  first `nExp` of IDS in experiments (the rest of the queue in ideation), run operations kept or cleared, and m_EXP = m
 *  (set on today's memoised work context, the one value reAllocation reads). */
function state(heads: number, m: number, nExp: number, ops: boolean): GameStateV2 {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')) as GameStateV2;
  const p = s.player;
  const re = p.teams.filter((t) => t.role === 're' && t.dept === 'cap');
  const keep = { ...re[0], heads: heads * TEAM_SIZE.re };
  p.teams = [...p.teams.filter((t) => !(t.role === 're' && t.dept === 'cap')), keep];
  if (!ops) {
    p.models.runs = [];
    delete p.models.stream;
  }
  p.research.queue = [...IDS];
  IDS.forEach((id, i) => {
    p.tree[id] = { status: 'researching', progress: 0, attempts: 1, cap: { ...freshCap(), ...(i < nExp ? { stage: 'test' as const } : {}) } };
  });
  workContext(s).slots.EXP.m = m;
  return s;
}

const fmt = (a: ReturnType<typeof reAllocation>) => IDS.slice(0, N).map((id) => (a.perProject.get(id) ?? 0).toFixed(2)).join(' ');

// (a) Pool short: projects in priority order, the last one served partial, the rest none.
{
  const H = 2;
  const ops = reOpsNeed(state(H, 1, N, true));
  const k = 3; // full projects, then one at half
  const m = (ops + RE_FULL_PROJECT * k + RE_FULL_PROJECT / 2) / H;
  const s = state(H, m, N, true);
  const a = reAllocation(s);
  const got = IDS.slice(0, N).map((id) => a.perProject.get(id) ?? 0);
  const want = got.map((_, i) => (i < k ? RE_FULL_PROJECT : i === k ? RE_FULL_PROJECT / 2 : 0));
  check(capReCapacity(s) === H && near(a.total, m * H) && near(a.re.ops, ops) && got.every((x, i) => near(x, want[i])) && near(a.idle, 0),
    '(a) pool short: run operations first, then projects by priority at their base need, the last one partial',
    `pool ${a.total.toFixed(2)} = m ${m.toFixed(2)} × ${H}; ops ${a.re.ops.toFixed(2)}; per project ${fmt(a)}`);
}

// (b) Pool long: every project gets its base need plus an equal share of the surplus; nothing idle.
{
  const H = 4;
  const m = 8;
  const s = state(H, m, N, true);
  const ops = reOpsNeed(s);
  const a = reAllocation(s);
  const each = RE_FULL_PROJECT + (m * H - ops - N * RE_FULL_PROJECT) / N;
  const got = IDS.slice(0, N).map((id) => a.perProject.get(id) ?? 0);
  check(each > RE_FULL_PROJECT && got.every((x) => near(x, each)) && near(a.idle, 0) && !a.perProject.has(IDS[N]),
    '(b) pool long: every project in experiments gets base + an equal surplus share; none idle; a project in ideation gets none',
    `pool ${a.total} − ops ${ops.toFixed(2)} over ${N}: each ${each.toFixed(3)}; got ${fmt(a)}; idle ${a.idle}`);
  const none = reAllocation(state(H, m, 0, true));
  check(none.perProject.size === 0 && near(none.idle, (m * H - ops) / m),
    '(b) research engineers are idle only when no project is in experiments (idle in human team-equivalents)',
    `no project in experiments: idle ${none.idle.toFixed(3)} human team-eq`);
}

// (c) Equal human heads: m = 10 runs 5× the projects at full base need that m = 2 does.
{
  const H = 2;
  const full = (m: number) => [...reAllocation(state(H, m, N, false)).perProject.values()].filter((x) => x >= RE_FULL_PROJECT - 1e-9).length;
  const f2 = full(2);
  const f10 = full(10);
  check(f2 > 0 && f10 === 5 * f2, '(c) at equal human heads, m = 10 runs 5× the projects at full base need of m = 2',
    `${H} human team-eq, no run operations: m = 2 → ${f2} full projects, m = 10 → ${f10}`);
}

// (d) No double m: a project's ℓ is (its effective share ÷ RE_LABOUR_UNIT)^λ, from the rule computed here.
{
  const H = 3;
  const lam = (s: GameStateV2) => s.hidden.timeline.prod.lam;
  const rows: string[] = [];
  let ok = true;
  for (const m of [1, 2.5, 10]) {
    const s = state(H, m, 4, false);
    const share = (m * H) / 4; // no run operations: a long pool (m H ≥ 8) splits evenly; short, the first project gets its base
    const id = IDS[0];
    const a = reAllocation(s);
    const expect = m * H >= 4 * RE_FULL_PROJECT ? share : Math.min(RE_FULL_PROJECT, m * H);
    const lInd = Math.pow(expect / RE_LABOUR_UNIT, lam(s));
    const pe = projectExpInputs(s, id, a);
    // experimentRate at the project's share against the CES at the independent ℓ.
    const P = s.hidden.timeline.prod;
    const flop = 1e20;
    const speed = 1.3;
    const rate = experimentRate(s, { speed }, a.perProject.get(id) ?? 0, flop);
    const rateInd = (Xces(P, flop / C_UNIT_FLOP_PER_DAY, lInd) * speed * Math.sqrt(RE_LABOUR_UNIT)) / 30;
    // The unit project (researchInputs) is the mean project in experiments: the whole pool over 4 (all of it goes to them).
    const inp = researchInputs(s, 4 * RE_FULL_PROJECT, flop, unitProjectRe(a));
    const lUnit = Math.pow((m * H) / 4 / RE_LABOUR_UNIT, lam(s));
    const good = near(pe.re, expect) && near(pe.l, lInd) && near(rate, rateInd, 1e-12 * Math.max(1, rateInd)) && near(inp.l, lUnit);
    ok &&= good;
    rows.push(`m ${m}: share ${pe.re.toFixed(3)} (rule ${expect.toFixed(3)}) ℓ ${pe.l.toFixed(4)} vs ${lInd.toFixed(4)}; unit ℓ ${inp.l.toFixed(4)} vs ${lUnit.toFixed(4)}`);
  }
  // A project in ideation reads what it would get if it joined (at least the base need), also at one m only.
  const s = state(H, 10, 4, false);
  const pe = projectExpInputs(s, IDS[5]);
  const join = Math.max(RE_FULL_PROJECT, (10 * H) / 5);
  ok &&= near(pe.reEval, join) && near(pe.l, Math.pow(join / RE_LABOUR_UNIT, lam(s)));
  rows.push(`ideation preview reEval ${pe.reEval.toFixed(3)} (rule ${join.toFixed(3)})`);
  check(ok, '(d) no double m: ℓ = (effective share ÷ RE_LABOUR_UNIT)^λ in projectExpInputs, experimentRate and researchInputs', rows.join('; '));
}

finish('repool');
