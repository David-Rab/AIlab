// Model v3 V2a research tests (design/V3-BUILD.md V2.9; MODEL-V3 §5, §8). Owner: WS1.
//   Lifecycle order (ideation → small experiments → scale test → result → adoption → known); only finished projects
//   can be adopted; the risk policy changes the pursued candidate; better taste lowers belief error; a failed project
//   reopens as speculative; line priors decline but their sum diverges; the assignment is deterministic and within 5% of
//   the brute-force optimum on small cases; research engineers and engineers overflow down their needs; a stage
//   without FLOP waits; headroom closes with tuning and refills on adoption; a quarter of small-scale wins of the
//   tweaks line survive at scale; the recipe never reads the know-how readout (lint).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { engine } from '../../src/engine/v2/index';
import { HEADROOM, LINE_DECAY, MAX_DROPS, PICK_AT, RISK_KAPPA, SMALL_TO_TEST, SURVIVE_FRAC } from '../../src/data/v2/research';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import {
  adoptProject, allocate, assignmentValue, attemptOdds, candidateTruth, capSciTeams, freshCap, lineDecay, newCandidate, pickCandidate,
  planAssignment, priorMean, reAllocation, reopenProject,
} from '../../src/engine/v2/models/research';
import { addIdea, headroomAt, initialStacks, stackAt, tuneDay } from '../../src/engine/v2/models/stacks';
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
  let adoptErr = '';
  for (let d = 0; d < 400 && s.player.tree.elastic?.status !== 'known'; d++) {
    tick(s, { skip: ['endings'] });
    const st = s.player.tree.elastic?.cap?.stage;
    if (st && seen[seen.length - 1] !== st) seen.push(st);
    if (st === 'small' && !adoptErr) adoptErr = adoptProject(s, 'elastic', () => 'x') ?? 'accepted';
  }
  const order = ['ideation', 'small', 'scale', 'adopting'];
  const compact = seen.filter((x, i) => x !== 'ideation' || i === 0);
  const inOrder = order.every((x) => seen.includes(x)) && seen.indexOf('small') < seen.indexOf('scale') && seen.indexOf('scale') < seen.indexOf('adopting');
  check(inOrder && s.player.tree.elastic?.status === 'known', 'lifecycle: ideation → small experiments → scale test → result → adoption → known', `${compact.join(' → ')} (${s.player.tree.elastic?.status}, seed ${seed})`);
  check(adoptErr === 'Only finished projects can be adopted', 'only finished projects can be adopted', adoptErr);
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
  const elite = err(1.25);
  const solid = err(0.8);
  check(elite < 0.7 * solid, 'taste: Elite scientists\' beliefs are closer to the truth than Solid ones\'', `mean |belief − truth| elite ${(elite / priorMean(n, 1)).toFixed(3)}, solid ${(solid / priorMean(n, 1)).toFixed(3)} × prior`);
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
    'reopen: a failed project restarts as speculative (half the odds, lower and wider prior)', `spec ${st2?.cap?.spec}, odds ${odds0} → ${attemptOdds(TREE_BY_ID.P05, 1)}, prior ×${(priorMean(TREE_BY_ID.P05, 1, 1) / priorMean(TREE_BY_ID.P05, 1, 0)).toFixed(2)}`);
}

// ---------- diminishing returns per line ----------
{
  let mono = true;
  for (let g = 1; g < 2000; g++) if (lineDecay(g + 1) > lineDecay(g)) mono = false;
  const S = (N: number) => { let x = 0; for (let g = 1; g <= N; g++) x += lineDecay(g); return x; };
  const s1 = S(1e4);
  const s2 = S(1e5);
  // A divergent series: the partial sum keeps growing like N^(1 − β) (×10^(1−β) per decade).
  check(mono && LINE_DECAY.beta < 1 && s2 / s1 > 0.9 * Math.pow(10, 1 - LINE_DECAY.beta), 'lines: generation priors decline but their sum diverges (β < 1)',
    `μ_100/μ_1 ${lineDecay(100).toFixed(3)}, Σ to 1e4 ${s1.toFixed(0)}, to 1e5 ${s2.toFixed(0)} (×${(s2 / s1).toFixed(2)})`);
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

// ---------- overflow: research engineers and engineers ----------
{
  const a = allocate(10, { order: ['ops', 'exp', 'tune'], max: { exp: 3 }, share: {} }, { ops: 2, exp: 8, tune: Infinity });
  check(a.ops === 2 && a.exp === 3 && a.tune === 5, 'allocation: each need up to its cap, unused capacity flows down the order', JSON.stringify(a));
  const b = allocate(10, { order: ['tune', 'ops', 'exp'], max: {}, share: { tune: 0.2 } }, { ops: 2, exp: 8, tune: Infinity });
  check(b.tune === 2 && b.ops === 2 && b.exp === 6, 'allocation: the order and share caps are the player\'s', JSON.stringify(b));
  const s = mk(4);
  for (const id of ['L.scale', 'L.data', 'L.rlalg']) act(s, 'research.queue', { id });
  for (let d = 0; d < 60; d++) tick(s, { skip: ['endings'] });
  const before = reAllocation(s);
  act(s, 'research.reAlloc', { need: 'exp', max: 0 });
  const after = reAllocation(s);
  check(before.re.exp > 0 && after.re.exp === 0 && Math.abs(after.re.tune - (before.re.tune + before.re.exp)) < 1e-9,
    'research engineers: with experiments capped, their capacity overflows to routine tuning', `exp ${before.re.exp.toFixed(1)} → ${after.re.exp}, tune ${before.re.tune.toFixed(1)} → ${after.re.tune.toFixed(1)}`);
  const r0 = buildRates(s);
  act(s, 'build.engAlloc', { need: 'builds', max: 0 });
  const r1 = buildRates(s);
  act(s, 'build.engAlloc', { order: 'builds,runs,upkeep', need: 'builds', max: -1 });
  const r2 = buildRates(s);
  check(r0.builds > 0 && r1.builds === 0 && r2.builds >= r0.builds - 1e-9, 'engineers: a capped need gets nothing, builds first get the most', `builds/day ${r0.builds.toFixed(2)} → ${r1.builds} → ${r2.builds.toFixed(2)}`);
}

// ---------- a stage without FLOP waits ----------
{
  const s = mk(6);
  act(s, 'research.queue', { id: 'L.scale' });
  act(s, 'research.want', { id: 'L.scale', n: 3 });
  let tested = false;
  for (let d = 0; d < 120 && !tested; d++) { tick(s, { skip: ['endings'] }); tested = !!s.player.tree['L.scale']?.cap?.test; }
  // Its FLOP need is set far above what the experiments pool can give in the window (the work still progresses).
  const t0 = s.player.tree['L.scale']?.cap?.test;
  if (t0) t0.flopNeed = 1e40;
  const stage0 = s.player.tree['L.scale']?.cap?.stage;
  for (let d = 0; d < 200; d++) tick(s, { skip: ['endings'] });
  const t1 = s.player.tree['L.scale']?.cap?.test;
  check(tested && !!t1 && t1.c.k === t0?.c.k && s.player.tree['L.scale']?.cap?.stage === stage0 && t1.work >= t1.workNeed - 1e-9 && t1.flop < t1.flopNeed,
    'a stage whose work is done waits for its experiment FLOP', `${stage0}: work ${t1?.work.toFixed(2)}/${t1?.workNeed.toFixed(2)}, FLOP ${t1?.flop.toExponential(1)}/${t1?.flopNeed.toExponential(1)}`);
}

// ---------- headroom ----------
{
  const st = initialStacks(0).pre;
  addIdea(st, 0.1, 0, 1e24);
  const h0 = headroomAt(st);
  const s = mk(7);
  s.player.research.stacks.pre = st;
  tuneDay(s, 3, 1);
  const h1 = headroomAt(st);
  for (let d = 0; d < 200; d++) tuneDay(s, 3, 1);
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
    if (t.x <= 0.3 * priorMean(n, 1)) continue;
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

check(PICK_AT >= 2, 'fixture: teams choose among at least two candidates');
finish('research');
