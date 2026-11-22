// Model v3 V2a research tests (design/V3-BUILD.md V2.9; MODEL-V3 §5, §8). Owner: WS1.
//   Lifecycle order (ideation → small experiments → scale test → result → adoption → known); only finished projects
//   can be adopted; the risk policy changes the pursued candidate; better taste lowers belief error; a failed project
//   reopens as speculative; line priors decline but their sum diverges (model v3 V3: the pool form from r); the assignment
//   is deterministic and within 5% of the brute-force optimum on small cases; research engineers and engineers overflow
//   down their needs; RD-B08: tuning wants research engineers ∝ headroom, after every project in experiments, and
//   experiment FLOP goes by need (more research engineers never lower a project's rate); a stage without experiment FLOP waits (V3: the experiment CES is 0 without compute); headroom closes with tuning and refills on adoption; a quarter of small-scale wins of the
//   tweaks line survive at scale; the recipe never reads the know-how readout (lint).
// Model v3 D9: P10 / P12 / P21 are typed data and suite effects; their old flat flags are gone (lint).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { engine } from '../../src/engine/v2/index';
import { HEADROOM, MAX_DROPS, PICK_AT, RE_PER_PROJECT, RISK_KAPPA, SMALL_TO_TEST, SURVIVE_FRAC, TUNE_RE_PER_OOM } from '../../src/data/v2/research';
import { TREE_BY_ID, type TreeNodeDef } from '../../src/data/v2/tree';
import {
  allocate,assignmentValue, attemptOdds, candidateTruth, capSciTeams, expShares, experimentRate, freshCap, hasTypedEffect, linePool, newCandidate, pickCandidate,
  planAssignment, poolMean, priorMean, projectFlopPerDay, reAllocation, reopenProject, researchInputs,
} from '../../src/engine/v2/models/research';
import { addIdea, headroomAt, headroomTotal, initialStacks, stackAt, tuneDay } from '../../src/engine/v2/models/stacks';
import { serialize, deserialize } from '../../src/engine/v2/core/save';
import { syncTeams } from '../../src/engine/v2/departments/teams';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { buildRates } from '../../src/engine/v2/departments/build';
import type { Candidate, GameStateV2, Team } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

const mk = (seed = 11): GameStateV2 => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed, tutorial: false }));
const act = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}) => engine.act(s, id, p);

// ---------- lifecycle order ----------
{
  // A seed where Elastic training works (odds 0.9): its stages in order, then the engineers build it in.
  let seed = 1;
  for (; seed < 40; seed++) {
    const t = mk(seed);
    if (candidateTruth(t, TREE_BY_ID.elastic, freshCap(), { k: 1, gen: 1, nov: 0.5, b: 1, q: 1, mu: 0, sd: 1, muS: 0, sdS: 0 }).x > 0.01) break;
  }
  const s = mk(seed);
  act(s, 'research.start', { id: 'elastic' });
  act(s, 'research.want', { id: 'elastic', n: 3 });
  const seen: string[] = [];
  for (let d = 0; d < 400 && s.player.tree.elastic?.status !== 'known'; d++) {
    tick(s, { skip: ['endings'] });
    const st = s.player.tree.elastic?.cap?.stage;
    if (st && seen[seen.length - 1] !== st) seen.push(st);
  }
  const order = ['ideation', 'small', 'scale', 'adopting'];
  const compact = seen.filter((x, i) => x !== 'ideation' || i === 0);
  const inOrder = order.every((x) => seen.includes(x)) && seen.indexOf('small') < seen.indexOf('scale') && seen.indexOf('scale') < seen.indexOf('adopting');
  check(inOrder && s.player.tree.elastic?.status === 'known', 'lifecycle: ideation → small experiments → scale test → result → adoption → known', `${compact.join(' → ')} (${s.player.tree.elastic?.status}, seed ${seed})`);
  check(s.player.research.adopted.some((a) => a.id === 'elastic') && stackAt(s.player.research.stacks.train) > 0, 'adoption: the true effect enters its stack (training throughput)', `${stackAt(s.player.research.stacks.train).toFixed(4)} OOM`);
}

// ---------- risk policy ----------
{
  const cands: Candidate[] = [
    { k: 1, gen: 1, nov: 0.1, b: 1, q: 1, mu: 1.0, sd: 0.1, muS: 0, sdS: 0 },
    { k: 2, gen: 1, nov: 0.9, b: 1, q: 1, mu: 0.95, sd: 0.8, muS: 0, sdS: 0 },
  ];
  const safe = pickCandidate(cands, RISK_KAPPA.safe);
  const spec = pickCandidate(cands, RISK_KAPPA.speculative);
  check(safe === 0 && spec === 1, 'risk policy: safe pursues the surer candidate, speculative the less certain one', `safe #${cands[safe].k}, speculative #${cands[spec].k}`);
  // In the engine: the same world and teams with the other policy test a different first candidate somewhere.
  const first = (risk: string) => {
    const s = mk(5);
    act(s, 'research.risk', { risk });
    for (const id of ['L.scale', 'L.data', 'L.opt', 'L.rlalg', 'L.env']) act(s, 'research.queue', { id });
    const picks: string[] = [];
    for (let d = 0; d < 120; d++) {
      tick(s, { skip: ['endings'] });
      for (const id of ['L.scale', 'L.data', 'L.opt', 'L.rlalg', 'L.env']) {
        const t = s.player.tree[id]?.cap?.test;
        if (t && !picks.some((x) => x.startsWith(id + ':' + t.c.gen + ':'))) picks.push(`${id}:${t.c.gen}:${t.c.k}`);
      }
    }
    return picks;
  };
  const a = first('safe');
  const b = first('speculative');
  const diff = a.filter((x, i) => b[i] !== x).length;
  check(diff > 0, 'risk policy: in the engine, safe and speculative pursue different candidates', `${diff} of ${a.length} picks differ`);
}

// ---------- taste lowers belief error ----------
{
  const s = mk(3);
  const n = TREE_BY_ID['L.scale'];
  const err = (q: number) => {
    const st = freshCap();
    let e = 0;
    for (let i = 0; i < 400; i++) {
      const c = newCandidate(s, n, st, q, 1);
      e += Math.abs(c.mu - candidateTruth(s, n, st, c).x);
    }
    return e / 400;
  };
  // Model v3 V3: taste is the team's place on the AIFM taste distribution (Elite +1 SD ≈ ×1.46, Solid −0.5 SD ≈ ×0.83 at
  // m2b 3.25). It is also research input in the line's pool, so the error is compared relative to each candidate's prior.
  const elite = err(1.46) / priorMean(s, n, { q: 1.46 });
  const solid = err(0.83) / priorMean(s, n, { q: 0.83 });
  check(elite < 0.7 * solid, 'taste: Elite scientists\' beliefs are closer to the truth than Solid ones\'', `mean |belief − truth| elite ${elite.toFixed(3)}, solid ${solid.toFixed(3)} × prior`);
}

// ---------- failure and speculative reopening ----------
{
  // P05 does not work on its first attempt in the seed-2027 world (its hidden paradigm draw).
  const s = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
  check(s.hidden.paradigmSuccess.P05 === false, 'fixture: P05 is a dud in the seed-2027 world');
  act(s, 'research.start', { id: 'P05' });
  act(s, 'research.want', { id: 'P05', n: 3 });
  for (let d = 0; d < 600 && s.player.tree.P05?.status !== 'failed'; d++) tick(s, { skip: ['endings'] });
  tick(s, { skip: ['endings'] }); // the failed project leaves the queue on the next research day
  const st = s.player.tree.P05;
  check(st?.status === 'failed' && (st.cap?.drops ?? 0) >= MAX_DROPS && !s.player.research.queue.includes('P05'), `failure: a dud direction fails after ${MAX_DROPS} dropped candidates and leaves the queue`, `${st?.status}, drops ${st?.cap?.drops}`);
  const odds0 = attemptOdds(TREE_BY_ID.P05, 0);
  check(reopenProject(s, 'L.scale') !== undefined, 'reopen: lines cannot be reopened (they never fail)');
  act(s, 'research.reopen', { id: 'P05' });
  const st2 = s.player.tree.P05;
  check(st2?.status === 'researching' && st2.cap?.spec === 1 && s.player.research.queue.includes('P05') && Math.abs(attemptOdds(TREE_BY_ID.P05, 1) - odds0 / 2) < 1e-12,
    'reopen: a failed project restarts as speculative (half the odds, lower and wider prior)', `spec ${st2?.cap?.spec}, odds ${odds0} → ${attemptOdds(TREE_BY_ID.P05, 1)}, prior ×${(priorMean(s, TREE_BY_ID.P05, {}, 1) / priorMean(s, TREE_BY_ID.P05, {}, 0)).toFixed(2)}`);
}

// ---------- diminishing returns per line (model v3 V3: a pool with returns r) ----------
{
  const s = mk(4);
  const pool = linePool(s, TREE_BY_ID['L.scale']);
  let mono = true;
  for (let n = 0; n < 2000; n++) if (poolMean(pool, n + 1, 1, 1) > poolMean(pool, n, 1, 1)) mono = false;
  const S = (N: number) => { let x = 0; for (let n = 0; n < N; n++) x += poolMean(pool, n, 1, 1); return x; };
  const s1 = S(1e4);
  const s2 = S(1e5);
  // A divergent series: the partial sum grows as r·log₁₀(N): each decade of ideas adds ≈ r_l OOM (×10 of research input).
  check(mono && s2 - s1 > 0.9 * pool.r && s2 - s1 < 1.01 * pool.r, 'lines: priors decline but their sum diverges (the pool adds r_l OOM per ×10 of research input)',
    `μ_100/μ_1 ${(poolMean(pool, 100, 1, 1) / poolMean(pool, 0, 1, 1)).toFixed(3)}, Σ to 1e4 ${s1.toFixed(3)}, to 1e5 ${s2.toFixed(3)} OOM (r_l ${pool.r.toFixed(3)}, n₀ ${pool.n0.toFixed(0)})`);
}

// ---------- assignment ----------
{
  const s = mk(2);
  for (const id of ['L.scale', 'L.rlalg', 'P07', 'L.infer']) act(s, 'research.queue', { id });
  const ready = s.player.research.queue.filter((id) => TREE_BY_ID[id]?.kind);
  const a = planAssignment(s, ready);
  const b = planAssignment(s, ready);
  const rev = { ...s, player: { ...s.player, teams: [...s.player.teams].reverse() } } as GameStateV2;
  const c = planAssignment(rev, ready);
  const same = (x: typeof a, y: typeof a) => [...x.entries()].every(([k, v]) => y.get(k)?.p === v.p);
  check(same(a, b) && same(a, c) && [...a.values()].every((v) => v.why.length > 0), 'assignment: deterministic (same result twice and whatever the roster order), with a reason for every team');

  // Brute force on small cases: ≤ 5 teams, ≤ 4 projects, random specialties/qualities/teams wanted.
  let worst = 1;
  let cases = 0;
  const cols = ['pretraining', 'posttraining', 'systems'] as const;
  const quals = ['solid', 'strong', 'elite'] as const;
  const pool = ['L.scale', 'L.data', 'L.rlalg', 'L.env', 'L.infer', 'P07', 'elastic'];
  let rnd = 12345;
  const r = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let trial = 0; trial < 60; trial++) {
    const t = mk(2);
    const nT = 2 + Math.floor(r() * 4);
    const nP = 1 + Math.floor(r() * 4);
    const others = t.player.teams.filter((x) => !(x.role === 'sci' && x.dept === 'cap'));
    const teams: Team[] = [];
    for (let i = 0; i < nT; i++) teams.push({ id: `S${i}`, role: 'sci', dept: 'cap', size: 40, heads: 40, quality: quals[Math.floor(r() * 3)], specialty: cols[Math.floor(r() * 3)] });
    t.player.teams = [...others, ...teams];
    const projs = [...pool].sort(() => r() - 0.5).slice(0, nP);
    t.player.research.queue = projs;
    for (const p of projs) t.player.research.want[p] = 1 + Math.floor(r() * 2);
    const plan = planAssignment(t, projs);
    const got = assignmentValue(projs, teams.map((x) => ({ t: x, p: plan.get(x.id)?.p })));
    const counts = projs.map((p) => teams.filter((x) => plan.get(x.id)?.p === p).length);
    // Every assignment with the same team count per project.
    let best = 0;
    const assign: (string | undefined)[] = new Array(nT).fill(undefined);
    const rec = (i: number, left: number[]) => {
      if (i === nT) {
        if (left.every((x) => x === 0)) best = Math.max(best, assignmentValue(projs, teams.map((x, j) => ({ t: x, p: assign[j] }))));
        return;
      }
      for (let k = 0; k < projs.length; k++) if (left[k] > 0) { left[k]--; assign[i] = projs[k]; rec(i + 1, left); left[k]++; }
      const placed = counts.reduce((a2, x) => a2 + x, 0);
      if (placed < nT) { assign[i] = undefined; rec(i + 1, left); }
    };
    rec(0, [...counts]);
    if (best > 0) { worst = Math.min(worst, got / best); cases++; }
  }
  check(worst >= 0.95, 'assignment: within 5% of the brute-force optimum of total progress (≤ 5 teams, ≤ 4 projects)', `worst ${(100 * worst).toFixed(1)}% over ${cases} cases`);
  const team = capSciTeams(s)[0];
  check(!!team, 'fixture: capability science teams exist');
}

// ---------- B4: "auto" teams wanted ----------
{
  // Six capability science teams on three projects: one fixed at 1 team, two on auto. The fixed project gets exactly its
  // number, each auto project at least one team, and the spare teams go to the auto projects (none idle, none to the
  // fixed project) where they add the most progress; with every project fixed at 1 the spares all join the top project.
  const t = mk(2);
  const others = t.player.teams.filter((x) => !(x.role === 'sci' && x.dept === 'cap'));
  const cols = ['pretraining', 'posttraining', 'systems', 'pretraining', 'posttraining', 'systems'] as const;
  const teams: Team[] = cols.map((c, i) => ({ id: `A${i}`, role: 'sci', dept: 'cap', size: 40, heads: 40, quality: 'strong', specialty: c }));
  t.player.teams = [...others, ...teams];
  const projs = ['L.scale', 'L.data', 'L.rlalg'];
  t.player.research.queue = [...projs];
  for (const id of projs) t.player.research.want[id] = 1;
  const fixed = planAssignment(t, projs);
  t.player.research.wantAuto = ['L.data', 'L.rlalg'];
  const auto = planAssignment(t, projs);
  const n = (plan: typeof auto, id: string) => teams.filter((x) => plan.get(x.id)?.p === id).length;
  const idle = teams.filter((x) => !auto.get(x.id)?.p).length;
  const vF = assignmentValue(projs, teams.map((x) => ({ t: x, p: fixed.get(x.id)?.p })));
  const vA = assignmentValue(projs, teams.map((x) => ({ t: x, p: auto.get(x.id)?.p })));
  check(n(auto, 'L.scale') === 1 && n(auto, 'L.data') >= 1 && n(auto, 'L.rlalg') >= 1 && idle === 0 && n(fixed, 'L.scale') === 4,
    'auto teams wanted: a fixed project gets its number, auto projects one team and then the spares; none idle',
    `auto: ${projs.map((id) => `${id} ${n(auto, id)}`).join(', ')}; all fixed at 1: ${projs.map((id) => `${id} ${n(fixed, id)}`).join(', ')}`);
  check(vA > vF, 'auto teams wanted: spreading the spares by fit beats piling them on the top project', `progress value ${vF.toFixed(3)} → ${vA.toFixed(3)}`);
  check(teams.filter((x) => auto.get(x.id)?.p === 'L.data' || auto.get(x.id)?.p === 'L.rlalg').some((x) => /^Auto: /.test(auto.get(x.id)?.why ?? '')), 'auto teams wanted: a spare team says it is there on auto');
  // The action: auto on, a number takes it off again; the view shows the placed count as the number.
  const s2 = mk(3);
  act(s2, 'research.queue', { id: 'L.scale' });
  act(s2, 'research.want', { id: 'L.scale', auto: true });
  const on = s2.player.research.wantAuto.includes('L.scale');
  act(s2, 'research.want', { id: 'L.scale', n: 2 });
  check(on && !s2.player.research.wantAuto.includes('L.scale') && s2.player.research.want['L.scale'] === 2, 'auto teams wanted: the action turns auto on, and a number turns it off', JSON.stringify(s2.player.research.wantAuto));
}

// ---------- overflow: research engineers and engineers ----------
{
  const a = allocate(10, { order: ['ops', 'exp', 'tune'], max: { exp: 3 }, share: {} }, { ops: 2, exp: 8, tune: Infinity });
  check(a.ops === 2 && a.exp === 3 && a.tune === 5, 'allocation: each need up to its cap, unused capacity flows down the order', JSON.stringify(a));
  const b = allocate(10, { order: ['tune', 'ops', 'exp'], max: {}, share: { tune: 0.2 } }, { ops: 2, exp: 8, tune: Infinity });
  check(b.tune === 2 && b.ops === 2 && b.exp === 6, 'allocation: the order and share caps are the player\'s', JSON.stringify(b));
  const s = mk(4);
  for (const id of ['L.scale', 'L.data', 'L.rlalg']) act(s, 'research.queue', { id });
  for (let d = 0; d < 60; d++) tick(s, { skip: ['endings'] });
  // RD-B08: tuning's demand is finite (TUNE_RE_PER_OOM × headroom); an adopted idea leaves some to tune.
  addIdea(s.player.research.stacks.pre, 0.05, 0, 1e24);
  const before = reAllocation(s);
  act(s, 'research.reAlloc', { need: 'exp', max: 0 });
  const after = reAllocation(s);
  const tuneWant = Math.min(after.demand.tune, before.re.tune + before.re.exp);
  const sum = (a: typeof after) => a.re.ops + a.re.evals + a.re.exp + a.re.tune;
  check(before.re.exp > 0 && after.re.exp === 0 && after.demand.tune > 0 && Number.isFinite(after.demand.tune) && Math.abs(after.re.tune - tuneWant) < 1e-9
    && Math.abs(after.total - sum(after) - Math.max(0, before.total - sum(before) + before.re.exp + before.re.tune - after.re.tune)) < 1e-9,
    'research engineers: with experiments capped, their capacity flows to routine tuning up to its demand; the rest is idle',
    `exp ${before.re.exp.toFixed(1)} → ${after.re.exp}, tune ${before.re.tune.toFixed(1)} → ${after.re.tune.toFixed(1)} (demand ${after.demand.tune.toFixed(2)}), idle ${(after.total - sum(after)).toFixed(2)}`);
  const r0 = buildRates(s);
  act(s, 'build.engAlloc', { need: 'builds', max: 0 });
  const r1 = buildRates(s);
  act(s, 'build.engAlloc', { order: 'builds,runs,upkeep', need: 'builds', max: -1 });
  const r2 = buildRates(s);
  check(r0.builds > 0 && r1.builds === 0 && r2.builds >= r0.builds - 1e-9, 'engineers: a capped need gets nothing, builds first get the most', `builds/day ${r0.builds.toFixed(2)} → ${r1.builds} → ${r2.builds.toFixed(2)}`);
}

// ---------- RD-B08: research engineers and experiment FLOP by need ----------
{
  const s = mk(5);
  for (const id of ['L.scale', 'L.data', 'L.rlalg', 'L.env', 'L.opt', 'L.infer']) act(s, 'research.queue', { id });
  let nExp = 0;
  for (let d = 0; d < 300 && nExp < 4; d++) { tick(s, { skip: ['endings'] }); nExp = reAllocation(s).perProject.size; }
  // Headroom to tune: an adopted 0.1 OOM leaves 0.03 OOM, i.e. 3 team-equivalents wanted on top of any already there.
  addIdea(s.player.research.stacks.pre, 0.1, 0, 1e24);
  const a0 = reAllocation(s);
  check(nExp >= 4 && a0.demand.tune > 2.9 && Math.abs(a0.demand.tune - TUNE_RE_PER_OOM * headroomTotal(s)) < 1e-9,
    'RD-B08: routine tuning wants research engineers in proportion to the remaining headroom (a finite need)',
    `${nExp} projects in experiments; headroom ${headroomTotal(s).toFixed(4)} OOM → tuning wants ${a0.demand.tune.toFixed(2)} team-eq`);
  // The same day with k research-engineer teams removed (k < 0) or added (k > 0).
  const ids = s.player.teams.filter((t) => t.role === 're' && t.dept === 'cap').map((t) => t.id);
  const variant = (k: number) => {
    const x = deserialize(serialize(s));
    if (k < 0) x.player.teams = x.player.teams.filter((t) => !ids.slice(0, -k).includes(t.id));
    const tpl = x.player.teams.find((t) => t.role === 're' && t.dept === 'cap')!;
    for (let i = 0; i < k; i++) x.player.teams.push({ ...tpl, id: `RD-B08-${i}` });
    syncTeams(x);
    resetWorkContext(x);
    const a = reAllocation(x);
    const avail = projectFlopPerDay(x);
    const sh = expShares(a, avail);
    const inp = researchInputs(x, Math.max(sh.units, RE_PER_PROJECT), avail);
    const rate = new Map([...a.perProject].map(([id, re]) => [id, experimentRate(x, inp, 1, re, sh.perProject.get(id) ?? 0)]));
    return { k, a, sh, rate, avail, x };
  };
  const vs = [];
  for (let k = -(ids.length - 1); k <= 4; k++) vs.push(variant(k));
  // (a) Projects in experiments are served before tuning: tuning holds research engineers only when every project has
  // its full RE_PER_PROJECT (INP-V01: the old 75% share left the 7th project at 0 while tuning kept engineers).
  const bad = vs.filter((v) => v.a.re.tune > 1e-9 && [...v.a.perProject.values()].some((re) => re < RE_PER_PROJECT - 1e-9));
  const short = vs.filter((v) => [...v.a.perProject.values()].some((re) => re < RE_PER_PROJECT - 1e-9));
  check(bad.length === 0 && short.length > 0 && short.every((v) => v.a.re.tune === 0),
    'RD-B08: tuning gets research engineers only after every project in experiments has its full need',
    `${vs.length} capacities ${vs[0].a.total.toFixed(1)}–${vs[vs.length - 1].a.total.toFixed(1)} team-eq; ${short.length} short of the projects' need (tuning 0 in each); violations ${bad.map((v) => v.k).join(',') || 'none'}`);
  // (b) More research engineers never lower a project's research engineers, FLOP or rate. The FLOP is by need, so it is
  // exactly flat; the rate may dip by the AI labour multiplier m_EXP = L/H, which spreads the same AI labour over the
  // extra (idle) humans (< 0.5%; departments/workfit.ts labourOf, DD-11 / DD-13).
  let worstRate = Infinity;
  let worstFlop = Infinity;
  let worstRe = Infinity;
  for (let i = 1; i < vs.length; i++) {
    for (const [id, r] of vs[i - 1].rate) {
      const re0 = vs[i - 1].a.perProject.get(id) ?? 0;
      const re1 = vs[i].a.perProject.get(id) ?? 0;
      worstRe = Math.min(worstRe, re1 - re0);
      const f0 = vs[i - 1].sh.perProject.get(id) ?? 0;
      const f1 = vs[i].sh.perProject.get(id) ?? 0;
      if (f0 > 0) worstFlop = Math.min(worstFlop, f1 / f0);
      if (r > 0) worstRate = Math.min(worstRate, (vs[i].rate.get(id) ?? 0) / r);
    }
  }
  check(worstRe >= -1e-9 && worstFlop >= 1 - 1e-9 && worstRate >= 0.995,
    'RD-B08: adding research engineers never lowers a project\'s research engineers, experiment FLOP or rate (FLOP by need, not headcount)',
    `worst step: RE ${worstRe.toFixed(3)}, FLOP ×${worstFlop.toFixed(4)}, rate ×${worstRate.toFixed(4)}`);
  // (c) Tuning's FLOP is what the projects leave: with RE to spare, the pool splits RE_PER_PROJECT per project and
  // tuning's demand; with no headroom tuning wants nobody, the projects take the whole pool and the rest is idle.
  const top = vs[vs.length - 1];
  const units = top.a.perProject.size * RE_PER_PROJECT + top.a.demand.tune;
  const projFlop = [...top.sh.perProject.values()].reduce((x, y) => x + y, 0);
  const z = deserialize(serialize(top.x));
  for (const k of ['pre', 'rlMid', 'rlCeil', 'train', 'serve'] as const) for (const b of z.player.research.stacks[k].buckets) b.h = 0;
  resetWorkContext(z);
  const az = reAllocation(z);
  const shz = expShares(az, 1);
  const usedZ = az.re.ops + az.re.evals + az.re.exp + az.re.tune;
  check(Math.abs(top.sh.tune - top.avail * top.a.demand.tune / units) < 1e-6 * top.avail && Math.abs(projFlop + top.sh.tune - top.avail) < 1e-6 * top.avail
    && az.demand.tune === 0 && az.re.tune === 0 && shz.tune === 0 && Math.abs([...shz.perProject.values()].reduce((x, y) => x + y, 0) - 1) < 1e-9 && az.total - usedZ > 0,
    'RD-B08: tuning takes the FLOP the projects leave; with no headroom it wants no one and spare research engineers are idle',
    `tuning ${(100 * top.sh.tune / top.avail).toFixed(1)}% of FLOP at demand ${top.a.demand.tune.toFixed(2)}; no headroom: idle ${(az.total - usedZ).toFixed(2)} team-eq`);
}

// ---------- a stage without FLOP waits ----------
{
  const s = mk(6);
  act(s, 'research.queue', { id: 'L.scale' });
  act(s, 'research.want', { id: 'L.scale', n: 3 });
  let tested = false;
  for (let d = 0; d < 120 && !tested; d++) { tick(s, { skip: ['endings'] }); tested = !!s.player.tree['L.scale']?.cap?.test; }
  // Model v3 V3: experiments run at the CES X(c, ℓ) of the project's FLOP and labour; with no experiment compute X = 0
  // (ρ < 0), so the stage waits however many research engineers it has.
  const t0 = s.player.tree['L.scale']?.cap?.test;
  const w0 = t0?.work ?? 0;
  const stage0 = s.player.tree['L.scale']?.cap?.stage;
  s.player.researchManual = true;
  s.player.split.agents += s.player.split.experiments;
  s.player.split.experiments = 0;
  s.player.policies.spareTraining = 'data';
  for (let d = 0; d < 200; d++) tick(s, { skip: ['endings'] });
  const t1 = s.player.tree['L.scale']?.cap?.test;
  check(tested && !!t1 && t1.c.k === t0?.c.k && s.player.tree['L.scale']?.cap?.stage === stage0 && t1.work <= w0 + 1e-9,
    'a stage without experiment FLOP waits', `${stage0}: work ${w0.toFixed(2)} → ${t1?.work.toFixed(2)} of ${t1?.workNeed.toFixed(2)}`);
}

// ---------- headroom ----------
{
  const st = initialStacks(0).pre;
  addIdea(st, 0.1, 0, 1e24);
  const h0 = headroomAt(st);
  const s = mk(7);
  s.player.research.stacks.pre = st;
  tuneDay(s, 3 / 270);
  const h1 = headroomAt(st);
  for (let d = 0; d < 200; d++) tuneDay(s, 3 / 270);
  const h2 = headroomAt(st);
  addIdea(st, 0.1, 0, 1e24);
  const h3 = headroomAt(st);
  check(Math.abs(h0 - HEADROOM * 0.1) < 1e-12 && h1 < h0 && h2 < 0.2 * h0 && Math.abs(h3 - h2 - HEADROOM * 0.1) < 1e-12 && Math.abs(stackAt(st) - (0.2 - h3)) < 1e-12,
    'headroom: an adopted idea leaves 30% as headroom, tuning closes it, adoption refills it', `${h0.toFixed(3)} → ${h1.toFixed(4)} → ${h2.toFixed(4)} → ${h3.toFixed(4)}`);
  // Scale dependence: an idea with s > 0 is worth more at a bigger run.
  const st2 = initialStacks(0).pre;
  addIdea(st2, 0.1, 0.1, 1e24);
  check(stackAt(st2, 1e26) > stackAt(st2, 1e24) * 1.5, 'stacks: a scale-dependent idea grows with run FLOP ((F/F_test)^s)', `${stackAt(st2, 1e24).toFixed(3)} at 1e24, ${stackAt(st2, 1e26).toFixed(3)} at 1e26`);
}

// ---------- a quarter of small-scale wins survive at scale (tweaks line, R20 B5) ----------
{
  const s = mk(8);
  const n = TREE_BY_ID['L.opt'];
  const st = freshCap();
  let wins = 0;
  let survive = 0;
  for (let k = 1; k <= 2000; k++) {
    const c: Candidate = { k, gen: 1, nov: 0.5, b: 1, q: 1, mu: 0, sd: 1, muS: 0, sdS: 0 };
    const t = candidateTruth(s, n, st, c);
    if (t.x <= 0.3 * priorMean(s, n, c)) continue;
    wins++;
    if (t.x * Math.pow(SMALL_TO_TEST, t.s) >= SURVIVE_FRAC * t.x) survive++;
  }
  const f = survive / Math.max(1, wins);
  check(f > 0.15 && f < 0.35, 'tweaks line: about a quarter of small-scale wins survive the scale test (R20 B5)', `${(100 * f).toFixed(0)}% of ${wins}`);
}

// ---------- lint: the recipe never reads the know-how readout ----------
{
  const root = join(HERE, '..', '..', 'src', 'engine', 'v2');
  const files: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
  walk(root);
  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/\beStack\s*\(|\brecipeAt\s*\(/.test(src)) bad.push(`${f}: know-how bridge call`);
  }
  for (const name of ['models/runs.ts', 'models/stacks.ts', 'models/research.ts', 'models/effective.ts']) {
    const src = readFileSync(join(root, name), 'utf8').split('\n');
    src.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*\*?.*?(\*\/|$)/, '').replace(/^\s*\*.*$/, '');
      // Reads of the readout: `player.pa` / `p.pa` not followed by an assignment. Allowed: copying it into readout
      // fields (paAtStart) and addKnowledge's cause bookkeeping (the change of the readout).
      if (/(player|\bp)\.pa\b(?!\s*=[^=])/.test(code) && !/paAtStart|const before = s\.player\.pa|s\.player\.pa - before/.test(code)) bad.push(`${name}:${i + 1}: ${line.trim()}`);
    });
  }
  check(bad.length === 0, 'lint: e_stack never comes from the know-how readout (no eStack/recipeAt; runs, stacks, research and effective do not read player.pa)', bad.slice(0, 4).join(' | '));
}

// ---------- model v3 D9: P10, P12, P21 are typed data / suite effects (no flat level bonuses, old flags gone) ----------
{
  const typed = ['P10', 'P12', 'P21'].map((id) => ({ id, n: TREE_BY_ID[id] }));
  const want: Record<string, (e: NonNullable<TreeNodeDef['effect']>) => boolean> = {
    P10: (e) => (e.data?.synQMax ?? 0) > 0 && !e.data?.worthOom,
    P12: (e) => e.expert?.family === 'longHorizon' && e.expert.tokensT > 0,
    P21: (e) => (e.data?.worthOom ?? 0) > 0 && !e.data?.synQMax,
  };
  const bad = typed.filter(({ id, n }) => !n.kind || !n.effect || n.effect.stack || n.effect.domains || !want[id](n.effect) || !hasTypedEffect(n)).map((x) => x.id);
  check(bad.length === 0, 'D9: P10, P12 and P21 are capability projects with typed effects (P10 synthetic-quality ceiling, P12 long-tasks expert data, P21 token worth); no stack, domain or cash-at-start flags',
    typed.map(({ id, n }) => `${id} ${n.kind} ${JSON.stringify(n.effect)}`).join('; '));
  const root = join(HERE, '..', '..', 'src');
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        if (/P10_SYN_MULT|\bnoRepeat\b|opts\.p10|\bp10: on\b|PARADIGM_DOMAIN_OFF|\bparadigmOff\b|P12_HORIZON|adopted\(s, '(P10|P12|P21)'\)|paradigms\.(P10|P12|P21)\b/.test(l)) hits.push(`${p.slice(root.length + 1)}:${i + 1}`);
        if (/LATER\(V5\)/.test(l) && /P10|P12|P21|synthetic|sample efficiency|human demos/i.test(l)) hits.push(`${p.slice(root.length + 1)}:${i + 1} LATER(V5)`);
      });
    }
  };
  walk(root);
  const texts = typed.map(({ n }) => n.cap ?? '');
  const oldText = texts.filter((t) => /synthetic data ×3|no data wall|no repetition penalty|h80 ×2|Time horizon ×2|RSCH \+0\.4|PHYS \+1/i.test(t));
  check(hits.length === 0 && oldText.length === 0, 'D9 lint: the old flags are gone (synthetic ×3, no repetition penalty / data wall, horizon ×2, RSCH +0.4, PHYS +1; no adopted() readers; no LATER(V5) markers for them)',
    [...hits, ...oldText].slice(0, 6).join(' | '));
}

check(PICK_AT >= 2, 'fixture: teams choose among at least two candidates');
finish('research');
