// Model v3 V2a research tests (design/archive/V3-BUILD.md V2.9; MODEL-V3 §5, §8). Owner: WS1.
//   Lifecycle order (ideation → small experiments → scale test → result → adoption → known); only finished projects
//   can be adopted; the risk policy changes the pursued candidate; better taste lowers belief error; a failed project
//   reopens as speculative; line priors decline but their sum diverges (model v3 V3: the pool form from r); the assignment
//   is deterministic and within 5% of the brute-force optimum on small cases; research engineers and engineers overflow
//   down their needs (spare research engineers are idle: RD-E03, no routine tuning); RD-E03: an adopted idea's full effect
//   is in its stack at build-in (no headroom; migration 47 → 48); RD-B08: experiment FLOP goes by need (more research engineers never lower a project's rate); RD-B09: research engineers are
//   the one owner of run operations (engineers are charged only setups) and a shortfall slows runs to the share served; RD-B16: Software progress counts only adopted ideas at a fixed F (a new base or a diffusion inflow does not move it; public knowledge is its own readout) and theft / leaks compare recipes with one recipeG at RECIPE_F; a stage without experiment FLOP waits (V3: the experiment CES is 0 without compute); a quarter of small-scale wins of the
//   tweaks line survive at scale; the recipe never reads the know-how readout (lint).
// Model v3 D9: P10 / P12 / P21 are typed data and suite effects.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { engine } from '../../src/engine/v2/index';
import { DEFAULT_RE_ALLOC, IDEA_DEFAULT_TM, MAX_DROPS, PICK_AT, RE_FULL_PROJECT, RISK_KAPPA, SMALL_TO_TEST, SURVIVE_FRAC } from '../../src/data/v2/research';
import { PROJECT_BY_ID, TREE_BY_ID, type TreeNodeDef } from '../../src/data/v2/tree';
import { makeCtx } from '../../src/engine/v2/core/loop';
import {
  allocate,assignmentValue, attemptOdds, capEta, effortClassOf, effortOfNode, isCapProject, isUnlockProject, trialWork, candidateTruth, capSciTeams, completeAdoption, dropRule, giveUpText, stagesOf, expShares, experimentRate, freshCap, hasTypedEffect, linePool, newCandidate, pickCandidate,
  planAssignment, poolMean, priorMean, projectFlopPerDay, reAllocation, reopenProject, researchInputs, softwareProgressDay,
} from '../../src/engine/v2/models/research';
import {
  addIdea, diffusedLift, playerRecipeG, raiseDiffused, STACK_KEYS, initialStacks, latestBaseFlop, researchG, stackAt, stacksGEquiv,
} from '../../src/engine/v2/models/stacks';
import { capProjectView, otherEffectViews, softwareRate, stackViews, STAGES } from '../../src/engine/v2/models/researchView';
import { projectEta } from '../../src/engine/v2/models/tree';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { AGENDA_BY_ID } from '../../src/data/v2/agendas';
import { serialize, deserialize } from '../../src/engine/v2/core/save';
import { syncTeams } from '../../src/engine/v2/departments/teams';
import { resetWorkContext } from '../../src/engine/v2/departments/workfit';
import { buildRates, engDemand, isStackWork, upkeepLines } from '../../src/engine/v2/departments/build';
import { runStall } from '../../src/engine/v2/models/runs';
import type { AgendaId, Candidate, GameStateV2, Team } from '../../src/engine/v2/types';
import { FIXTURE_DIR, HERE, check, finish, runRef } from './lib';
import { hash32 } from '../../src/engine/v2/core/rng';

const mk = (seed = 11): GameStateV2 => newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed, tutorial: false }));
const act = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}) => engine.act(s, id, p);

// ---------- RD-R07 four stages; one effort number per node (run alone: `tsx scripts/v2/research.ts --rd-r07`) ----------
// ---------- RD-E03 no headroom, no routine tuning (run alone: `tsx scripts/v2/research.ts --rd-e03`) ----------
if (process.argv.includes('--rd-e03')) {
  // An adopted idea's full true effect is in its stack at build-in (a scale-invariant line, so the effect is F-free).
  const s = mk(7);
  const ctx = makeCtx(s);
  const n = TREE_BY_ID['L.rlalg'];
  const c = newCandidate(s, n, freshCap(), 1, 1);
  const fTest = stagesOf(n).testFrac * latestBaseFlop(s);
  const r = { c, xTest: 0.05, sHat: 0, fTest, est: 0.05, estSd: 0.01, day: s.time.day, buildId: 'rde03' };
  s.player.tree[n.id] = { status: 'researching', progress: 1, cap: { ...freshCap(), pending: [r] } };
  const v0 = stackAt(s.player.research.stacks.rlMid, latestBaseFlop(s));
  completeAdoption(s, ctx, n.id, 'rde03', () => {});
  const ad = s.player.research.adopted[s.player.research.adopted.length - 1];
  const dv = stackAt(s.player.research.stacks.rlMid, latestBaseFlop(s)) - v0;
  const keys = [...new Set(STACK_KEYS.flatMap((k) => s.player.research.stacks[k].buckets.flatMap((b) => Object.keys(b))))].sort().join(',');
  check(ad?.id === n.id && Math.abs(ad.eff) > 0 && Math.abs(dv - ad.eff) < 1e-4 && keys === 'a,s',
    'RD-E03 an adopted idea adds its full true effect to its stack at build-in (no headroom part)', `effect ${ad?.eff} → stack +${dv.toFixed(5)}; bucket fields ${keys}`);
  // No 'tune' need: research engineers serve run operations and the projects (L5 pooled rule: the engineers left after the base
  // needs speed up the projects in experiments, so they are idle only when no project is in experiments).
  for (let d = 0; d < 5; d++) tick(s, { skip: ['endings'] });
  // Run on until a project is in experiments (the pooled rule leaves nobody idle then).
  for (let d = 0; d < 400 && reAllocation(s).perProject.size === 0; d++) tick(s, { skip: ['endings'] });
  tick(s, { skip: ['endings'] }); // the readout (last) is the day just run
  const al = reAllocation(s);
  const last = s.player.research.last;
  // The readout is the last tick's (EFFECTIVE team-equivalents; last.idle is in people): its needs make up the whole pool.
  const sum = last ? last.re.ops + last.re.exp : NaN;
  const nProj = al.perProject.size;
  const empty = deserialize(serialize(s));
  empty.player.research.queue = [];
  resetWorkContext(empty);
  const ae = reAllocation(empty);
  act(s, 'research.reAlloc', { order: 'ops,exp,tune,evals' });
  const order = s.player.research.re.order.join(',');
  check(Object.keys(al.demand).sort().join(',') === 'exp,ops' && !('tune' in (last?.re ?? {})) && order === DEFAULT_RE_ALLOC.order.join(',') && !order.includes('tune')
    && nProj > 0 && last?.idle === 0 && Math.abs(sum - al.total) < 0.01 && ae.perProject.size === 0 && ae.re.exp === 0 && ae.idle > 0 && Math.abs(ae.idle * ae.m + ae.re.ops - ae.total) < 1e-9,
    'RD-E03 / L7 no routine-tuning need; research engineers are idle only when no project is in experiments (the rest speed the projects up); an order naming tune is ignored',
    `needs ${Object.keys(al.demand).join(',')}; ${nProj} projects: idle ${last?.idle}, needs ${sum.toFixed(3)} of ${al.total.toFixed(3)} team-eq; with none: idle ${ae.idle.toFixed(2)} of ${ae.heads.toFixed(2)} people (run operations take the rest); order after a tune order ${order}`);
  finish('research');
}

// ---------- RD-R05 unlock projects: one works / doesn't test (run alone: `tsx scripts/v2/research.ts --rd-r05`) ----------
if (process.argv.includes('--rd-r05')) {
  const unlocks = Object.values(TREE_BY_ID).filter((n) => isUnlockProject(n));
  check(unlocks.length > 0 && unlocks.every((n) => !hasTypedEffect(n) && n.kind !== 'line') && !isUnlockProject(TREE_BY_ID.elastic), 'RD-R05 unlock projects are the ideas / axes without a typed effect', `${unlocks.length}: ${unlocks.map((n) => n.id).slice(0, 12).join(', ')}…`);
  // Run the first unlock that starts on day 0, with three teams, to its works draw.
  const res: string[] = [];
  let ran = 0;
  for (const n of unlocks) {
    if (ran >= 3) break;
    const s = mk(7);
    if (s.player.tree[n.id]?.cap || s.player.tree[n.id]?.status === 'known' || act(s, 'research.start', { id: n.id }) !== undefined) continue;
    act(s, 'research.want', { id: n.id, n: 3 });
    const seen: string[] = [];
    let bandOrCands = false;
    let workAtEnd = -1;
    let needAtEnd = -1;
    for (let d = 0; d < 900; d++) {
      const before = s.player.tree[n.id]?.cap?.trial;
      const bw = before ? { w: before.work, n: before.workNeed } : undefined;
      tick(s, { skip: ['endings'] });
      const ts = s.player.tree[n.id];
      const st = ts?.cap;
      const v = capProjectView(s, n.id);
      if (st && (st.cands.length || st.test || st.result)) bandOrCands = true;
      if (v && (v.belief || v.result || v.cands)) bandOrCands = true;
      for (const x of [st?.stage ?? '', v?.stage ?? '']) if (x && seen[seen.length - 1] !== x) seen.push(x);
      if (st && (st.stage === 'adopting' || st.stage === 'failed') && workAtEnd < 0) { needAtEnd = st.trial?.workNeed ?? bw?.n ?? 0; workAtEnd = st.trial?.work ?? (st.stage === 'adopting' ? needAtEnd : -1); }
      if (ts?.status === 'known' || ts?.status === 'failed') break;
    }
    const ts = s.player.tree[n.id];
    const spec = 0;
    const expect = n.paradigm ? s.hidden.paradigmSuccess[n.id] === true : hash32(s.setup.seed, `node:${n.id}`) / 4294967296 < attemptOdds(n, spec);
    const outcome = ts?.status === 'known' ? true : ts?.status === 'failed' ? false : undefined;
    const ok = !bandOrCands && outcome === expect && seen.every((x) => ['test', 'adopting', 'adoption', 'failed'].includes(x)) && Math.abs(needAtEnd - trialWork(n)) < 1e-9 && workAtEnd >= needAtEnd - 1e-9;
    res.push(`${n.id}: ${seen.join('→')} ${ts?.status} (draw ${expect}) work ${workAtEnd.toFixed(2)}/${needAtEnd.toFixed(2)}${bandOrCands ? ' BAND/CANDS' : ''}`);
    check(ok, `RD-R05 ${n.id}: no candidates or effect band; one test of the project's effort; completes by the works draw`, res[res.length - 1]);
    ran++;
  }
  check(ran > 0, 'RD-R05 at least one unlock project ran', String(ran));
  finish('research');
}

if (process.argv.includes('--rd-r07')) {
  check(STAGES.join(',') === 'ideation,small,scale,adoption', 'RD-R07 the player sees four stages (no result step)', STAGES.join(', '));
  // Every capability idea / axis: the effort shown (effortOfNode) is stagesOf's work and the node's one effortTM.
  const bad: string[] = [];
  for (const n of Object.values(TREE_BY_ID)) {
    if (!isCapProject(n) || n.kind === 'line') continue;
    const e = effortOfNode(n);
    const sg = stagesOf(n);
    const sum = PICK_AT * sg.idea + sg.small + sg.scale;
    if (Math.abs(e.sci + e.exp - sum) > 1e-9 || Math.abs(sum - (n.effortTM ?? IDEA_DEFAULT_TM)) > 1e-9) bad.push(`${n.id} ${(e.sci + e.exp).toFixed(3)} vs ${sum.toFixed(3)} vs ${n.effortTM}`);
  }
  check(!bad.length, 'RD-R07 effort shown = stagesOf sum = effortTM for every capability idea / axis', bad.join('; ') || 'all equal');
  // Neutral: the stage work is the earlier fit's (P17 fitted E 65.97: ideation 0.25E per candidate, scale 0.42E; RD-E01a
  // deleted P13, the node this checked before).
  const p17 = stagesOf(TREE_BY_ID.P17);
  check(Math.abs(p17.idea - 0.25 * 65.97) < 1e-9 && Math.abs(p17.scale - 0.42 * 65.97) < 1e-9, 'RD-R07 stage work unchanged (P17)', `${p17.idea.toFixed(4)} · ${p17.scale.toFixed(4)}`);
  // No 'result' stage reachable: a working project goes from the scale test straight to the engineers' build-in.
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
    const st: string | undefined = s.player.tree.elastic?.cap?.stage;
    const v: string = capProjectView(s, 'elastic')?.stage ?? '';
    for (const x of [st ?? '', v]) if (x && seen[seen.length - 1] !== x) seen.push(x);
  }
  check(!seen.includes('result') && seen.includes('adopting') && s.player.tree.elastic?.status === 'known', 'RD-R07 no result stage reached (engine or view)', seen.join(' → '));
  finish('research');
}

// ---------- RD-A03 science-team planner by value (run alone: `tsx scripts/v2/research.ts --rd-a03`) ----------
if (process.argv.includes('--rd-a03')) {
  const s = mk(2);
  const others = s.player.teams.filter((x) => !(x.role === 'sci' && x.dept === 'cap'));
  const teams: Team[] = [0, 1, 2, 3].map((i) => ({ id: `V${i}`, role: 'sci', dept: 'cap', size: 40, heads: 40, specialty: 'systems' }));
  s.player.teams = [...others, ...teams];
  const projs = ['elastic', 'P16', 'L.scale'];
  s.player.research.queue = [...projs];
  for (const id of projs) s.player.research.want[id] = 1;
  const on = (plan: ReturnType<typeof planAssignment>, id: string) => teams.filter((x) => plan.get(x.id)?.p === id).length;
  // (a) A one-off idea in its small (or big) test releases its scientists; a line in its test keeps them.
  s.player.tree.elastic = { status: 'researching', progress: 0.4, attempts: 1, cap: { ...freshCap(), stage: 'small' } };
  s.player.tree['L.scale'] = { status: 'researching', progress: 0.4, attempts: 1, cap: { ...freshCap(), stage: 'scale' } };
  const testing = planAssignment(s, projs);
  s.player.tree.elastic = { status: 'researching', progress: 0, attempts: 1, cap: freshCap() };
  const ideating = planAssignment(s, projs);
  check(on(testing, 'elastic') === 0 && on(testing, 'L.scale') >= 1 && on(ideating, 'elastic') >= 1,
    'RD-A03 a one-off idea in its test releases its scientists (a line in its test keeps them; back in ideation it gets them)',
    `in test: elastic ${on(testing, 'elastic')}, L.scale ${on(testing, 'L.scale')}; ideating: elastic ${on(ideating, 'elastic')}`);
  // (b) A spare team goes where it adds the most value (× AUTO_RANK_W per rank), not to the top project by default.
  const two = ['elastic', 'P16'];
  const with3 = (id: string) => [{ t: teams[0], p: 'elastic' }, { t: teams[1], p: 'P16' }, { t: teams[2], p: id }];
  const base = assignmentValue(s, two, [{ t: teams[0], p: 'elastic' }, { t: teams[1], p: 'P16' }]);
  const gE = assignmentValue(s, two, with3('elastic')) - base;
  const gP = (assignmentValue(s, two, with3('P16')) - base) * 0.8;
  s.player.teams = [...others, ...teams.slice(0, 3)];
  const spare = planAssignment(s, two);
  const where = teams.slice(0, 3).map((x) => spare.get(x.id)?.p);
  check(where.filter((p) => p === 'P16').length === 2 && gP > gE, 'RD-A03 a spare team goes to the higher-value project (P16 over the top-ranked elastic)',
    `teams → ${where.join(', ')}; spare gains: elastic ${gE.toExponential(2)}, P16 ×0.8 ${gP.toExponential(2)} OOM/day`);
  const whys = [...spare.values()].map((v) => v.why);
  check(whys.every((w) => /adds ~(<1|\d+)% to this project's yearly gain|carries all of this project's yearly gain/.test(w)), 'RD-A03 "why here" states the value in player language', whys.join(' | '));
  finish('research');
}

// ---------- RD-R06 drop and give-up rules (run alone: `tsx scripts/v2/research.ts --rd-r06`) ----------
{
  // A candidate under the floor but better than the pool's best goes on; under the floor and under the pool's best, or
  // with an empty pool, or a score ≤ 0, it is dropped; above the floor it always goes on.
  const kept = !dropRule(0.2, true, [0.1, 0.15]);
  const dropped = dropRule(0.2, true, [0.1, 0.3]) && dropRule(0.2, true, []) && dropRule(-0.1, true, [-0.5]);
  const above = !dropRule(0.2, false, [0.9]);
  check(kept && dropped && above, 'RD-R06 a candidate better than the pool\'s best is not dropped; worse, alone or ≤ 0 under the floor is', `kept ${kept}, dropped ${dropped}, above floor ${above}`);
  const txt = giveUpText('Elastic training', 'small experiments showed too little', 0.4, 0.2);
  check(/gave up/.test(txt) && /40%/.test(txt) && /20%/.test(txt) && !/does not (seem to )?work/.test(txt), 'RD-R06 give-up text shows the odds still standing (not "does not work")', txt);
  // A reopen starts a new attempt at 0 drops.
  const s = mk();
  s.player.tree.P09 = { status: 'failed', progress: 0, attempts: 1, cap: { ...freshCap(), drops: MAX_DROPS, stage: 'failed' } };
  reopenProject(s, 'P09');
  check(s.player.tree.P09.cap?.drops === 0, 'RD-R06 the drop count resets on reopen', String(s.player.tree.P09.cap?.drops));
  if (process.argv.includes('--rd-r06')) finish('research');
}

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
  check(inOrder && s.player.tree.elastic?.status === 'known', 'lifecycle: ideas → small test → big test → build-in → known', `${compact.join(' → ')} (${s.player.tree.elastic?.status}, seed ${seed})`);
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
  const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
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

  // Brute force on small cases: ≤ 5 teams, ≤ 4 projects, random specialties/teams wanted.
  let worst = 1;
  let cases = 0;
  const cols = ['pretraining', 'posttraining', 'systems'] as const;
  const pool = ['L.scale', 'L.data', 'L.rlalg', 'L.env', 'L.infer', 'P07', 'elastic'];
  let rnd = 12345;
  const r = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let trial = 0; trial < 60; trial++) {
    const t = mk(2);
    const nT = 2 + Math.floor(r() * 4);
    const nP = 1 + Math.floor(r() * 4);
    const others = t.player.teams.filter((x) => !(x.role === 'sci' && x.dept === 'cap'));
    const teams: Team[] = [];
    for (let i = 0; i < nT; i++) teams.push({ id: `S${i}`, role: 'sci', dept: 'cap', size: 40, heads: 40, specialty: cols[Math.floor(r() * 3)] });
    t.player.teams = [...others, ...teams];
    const projs = [...pool].sort(() => r() - 0.5).slice(0, nP);
    t.player.research.queue = projs;
    for (const p of projs) t.player.research.want[p] = 1 + Math.floor(r() * 2);
    const plan = planAssignment(t, projs);
    const got = assignmentValue(t, projs, teams.map((x) => ({ t: x, p: plan.get(x.id)?.p })));
    const counts = projs.map((p) => teams.filter((x) => plan.get(x.id)?.p === p).length);
    // Every assignment with the same team count per project.
    let best = 0;
    const assign: (string | undefined)[] = new Array(nT).fill(undefined);
    const rec = (i: number, left: number[]) => {
      if (i === nT) {
        if (left.every((x) => x === 0)) best = Math.max(best, assignmentValue(t, projs, teams.map((x, j) => ({ t: x, p: assign[j] }))));
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
  // fixed project) where they add the most value; with every project fixed at 1 the spares go by value (RD-A03).
  const t = mk(2);
  const others = t.player.teams.filter((x) => !(x.role === 'sci' && x.dept === 'cap'));
  const cols = ['pretraining', 'posttraining', 'systems', 'pretraining', 'posttraining', 'systems'] as const;
  const teams: Team[] = cols.map((c, i) => ({ id: `A${i}`, role: 'sci', dept: 'cap', size: 40, heads: 40, specialty: c }));
  t.player.teams = [...others, ...teams];
  const projs = ['L.scale', 'L.data', 'L.rlalg'];
  t.player.research.queue = [...projs];
  for (const id of projs) t.player.research.want[id] = 1;
  const fixed = planAssignment(t, projs);
  t.player.research.wantAuto = ['L.data', 'L.rlalg'];
  const auto = planAssignment(t, projs);
  const n = (plan: typeof auto, id: string) => teams.filter((x) => plan.get(x.id)?.p === id).length;
  const idle = teams.filter((x) => !auto.get(x.id)?.p).length;
  const vF = assignmentValue(t, projs, teams.map((x) => ({ t: x, p: fixed.get(x.id)?.p })));
  const vA = assignmentValue(t, projs, teams.map((x) => ({ t: x, p: auto.get(x.id)?.p })));
  check(n(auto, 'L.scale') === 1 && n(auto, 'L.data') >= 1 && n(auto, 'L.rlalg') >= 1 && idle === 0 && projs.reduce((a2, id) => a2 + n(fixed, id), 0) === 6,
    'auto teams wanted: a fixed project gets its number, auto projects one team and then the spares; none idle',
    `auto: ${projs.map((id) => `${id} ${n(auto, id)}`).join(', ')}; all fixed at 1: ${projs.map((id) => `${id} ${n(fixed, id)}`).join(', ')}`);
  check(vF >= vA * (1 - 1e-9), 'RD-A03 every project fixed: the spares go where they add the most value (no less than limited to the auto projects)', `value ${vA.toExponential(3)} → ${vF.toExponential(3)} OOM/day`);
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
  // RD-E03: no routine tuning; with experiments capped, their research engineers are idle.
  const before = reAllocation(s);
  act(s, 'research.reAlloc', { need: 'exp', max: 0 });
  const after = reAllocation(s);
  const sum = (a: typeof after) => a.re.ops + a.re.exp;
  check(before.re.exp > 0 && after.re.exp === 0 && Math.abs(after.total - sum(after) - (before.total - sum(before) + before.re.exp)) < 1e-9,
    'research engineers: with experiments capped, their capacity is idle',
    `exp ${before.re.exp.toFixed(1)} → ${after.re.exp}, idle ${(after.total - sum(after)).toFixed(2)}`);
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
  check(nExp >= 4, 'RD-B08: four or more projects in experiments for the checks below', `${nExp} projects in experiments`);
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
    const inp = researchInputs(x, Math.max(sh.units, RE_FULL_PROJECT), avail);
    const rate = new Map([...a.perProject].map(([id, re]) => [id, experimentRate(x, inp, re, sh.perProject.get(id) ?? 0)]));
    return { k, a, sh, rate, avail, x };
  };
  const vs = [];
  for (let k = -(ids.length - 1); k <= 4; k++) vs.push(variant(k));
  // (a) L5/L7 pooled rule: research engineers are idle only when no project is in experiments; every project gets its full
  // RE_FULL_PROJECT once the pool covers every base need, and the surplus is spread evenly over the projects.
  const bad = vs.filter((v) => {
    const vals = [...v.a.perProject.values()];
    const covered = v.a.total - v.a.re.ops >= vals.length * RE_FULL_PROJECT - 1e-9;
    return (vals.length > 0 && v.a.idle > 1e-9) || (covered && (vals.some((re) => re < RE_FULL_PROJECT - 1e-9) || Math.max(...vals) - Math.min(...vals) > 1e-9));
  });
  check(bad.length === 0,
    'RD-B08 / L7: research engineers are idle only when no project is in experiments; the surplus after every base need is spread evenly',
    `${vs.length} capacities ${vs[0].a.total.toFixed(1)}–${vs[vs.length - 1].a.total.toFixed(1)} team-eq; violations ${bad.map((v) => v.k).join(',') || 'none'}`);
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
  // (c) With research engineers to spare, the projects take the whole pool (nobody idle) and each gets more than its base need.
  const top = vs[vs.length - 1];
  const projFlop = [...top.sh.perProject.values()].reduce((x, y) => x + y, 0);
  const usedTop = top.a.re.ops + top.a.re.exp;
  const minTop = Math.min(...top.a.perProject.values());
  check(Math.abs(projFlop - top.avail) < 1e-6 * top.avail && Math.abs(top.a.total - usedTop) < 1e-9 && top.a.idle === 0 && minTop > RE_FULL_PROJECT,
    'RD-B08 / L7: with research engineers to spare the projects take the whole pool and none is idle; each project gets more than its base need',
    `projects ${(100 * projFlop / top.avail).toFixed(1)}% of FLOP; idle ${(top.a.total - usedTop).toFixed(2)} team-eq; least per project ${minTop.toFixed(2)} (base ${RE_FULL_PROJECT})`);
}

// ---------- RD-B09: run operations have one owner (research engineers); a shortfall slows runs ----------
{
  const s = mk(6);
  s.player.finance.cash = 1e3;
  act(s, 'launchPost', { baseId: 'B0', poolShare: 0.5 });
  const run = s.player.models.runs[s.player.models.runs.length - 1];
  for (let d = 0; d < 30 && run.readyDay === undefined; d++) tick(s, { skip: ['endings'] });
  tick(s, { skip: ['endings'] });
  // Engineers: the 'runs' need is only the setups / adoptions / eval harness work on the queue; no run upkeep line.
  const stack = s.player.build.queue.filter(isStackWork).reduce((a, it) => a + Math.max(0, it.needTW - it.doneTW), 0);
  const ed = engDemand(s);
  const lines = upkeepLines(s);
  check(run.status === 'running' && run.readyDay !== undefined && Math.abs(ed.runs - 7 * stack) < 1e-9 && !lines.some((l) => (l.kind as string) === 'run' || (l.kind as string) === 'stream'),
    'RD-B09: engineers are not charged run operations (their runs need = setups, adoptions and eval harness work only)',
    `engineers' runs need ${ed.runs.toFixed(2)} t-wk/wk (queue stack work ${stack.toFixed(2)} t-wk); upkeep lines: ${[...new Set(lines.map((l) => l.kind))].join(', ') || 'none'}`);
  // Research engineers: the same day with the ops need served in full and capped at half.
  const a = reAllocation(s);
  const day = (half: boolean) => {
    const x = deserialize(serialize(s));
    if (half) x.player.research.re.max.ops = a.demand.ops / 2;
    const r = x.player.models.runs.find((y) => y.id === run.id)!;
    const f0 = r.flopDone;
    tick(x, { skip: ['endings'] });
    return { df: r.flopDone - f0, served: x.player.research.last?.opsServed ?? 1, stall: runStall(x, r), x };
  };
  const full = day(false);
  const half = day(true);
  const ratio = half.df / Math.max(1e-30, full.df);
  check(a.demand.ops > 0 && full.served === 1 && Math.abs(half.served - 0.5) < 1e-3 && Math.abs(ratio - 0.5) < 2e-3 && /slowed/.test(half.stall ?? '') && full.stall === undefined,
    'RD-B09: a run with half its run-operations need served trains at half speed (and says why)',
    `ops need ${a.demand.ops.toFixed(3)} team-eq; served ${full.served} → ${half.served}; FLOP/day ×${ratio.toFixed(4)}; "${half.stall}"`);
  // RefBot keeps its runs operated (ops first in the default order): served in full on every day a run trains.
  const r = mk(2027);
  let worst = 1;
  let days = 0;
  runRef(r, 240, (g) => {
    if (g.player.models.runs.some((y) => y.status === 'running' && y.readyDay !== undefined)) { days++; worst = Math.min(worst, g.player.research.last?.opsServed ?? 1); }
    return false;
  });
  check(days > 30 && worst === 1, "RD-B09: RefBot's runs are fully operated (research engineers serve the ops need every day a run trains)", `${days} run-days to day 240, worst served ${worst}`);
}

// ---------- RD-B16: one recipe currency; Software progress counts only the lab's own research ----------
{
  // A RefBot lab at day 300 (adopted ideas, scale-dependent pretraining buckets, more than one base).
  const s = runRef(mk(2027), 300);
  const clone = (x: GameStateV2) => deserialize(serialize(x));
  const res = s.player.research;
  const bases = s.player.models.bases;
  // SCALE-DIAG M1: a day-300 RefBot lab may have no paradigm-tier idea yet (κ > 0 is rare), so the fixture adopts one at the
  // lab's test scale and re-reads the research readout (the stack's κ term is what a bigger base must not move).
  if (!res.stacks.pre.buckets.some((b) => b.t !== undefined && b.s > 1e-9 && b.a > 1e-9)) {
    addIdea(res.stacks.pre, 0.05, 0.2, 0.002 * latestBaseFlop(s), 1);
    res.gLast = researchG(s, res.gLastF as number);
  }
  const scaled = res.stacks.pre.buckets.some((b) => Math.abs(b.s) > 1e-9 && Math.abs(b.a) > 1e-9);
  check(bases.length > 0 && scaled && res.gLast !== undefined && res.gLastF === latestBaseFlop(s), 'fixture: the RD-B16 lab has a base, scale-dependent pretraining ideas and a research readout', `${bases.length} bases, scaled ${scaled}`);

  // Reference: one more research readout with nothing new.
  const ref = clone(s);
  softwareProgressDay(ref);
  const rate = (x: GameStateV2) => x.player.research.gRate ?? 0;
  // A new, 30× bigger base: the stacks' G at the latest base jumps, Software progress does not move.
  const big = clone(s);
  const last = big.player.models.bases[big.player.models.bases.length - 1];
  big.player.models.bases.push({ ...last, id: `${last.id}-rdb16`, flop: last.flop * 30 });
  const jump = stacksGEquiv(big) - stacksGEquiv(s);
  softwareProgressDay(big);
  check(Math.abs(jump) > 1e-3 && Math.abs(rate(big) - rate(ref)) < 1e-12 && big.player.research.gLastF === last.flop * 30,
    'RD-B16: a new, bigger base does not move Software progress (the recipe G at the latest base jumps; the rate holds F fixed)',
    `G at latest base ${jump >= 0 ? '+' : ''}${jump.toFixed(4)} OOM; rate ${(365 * rate(ref)).toFixed(4)} → ${(365 * rate(big)).toFixed(4)} OOM/yr`);
  // A diffusion inflow: public knowledge, its own readout, not Software progress.
  const dif = clone(s);
  const dG = 0.05;
  raiseDiffused(dif, undefined, playerRecipeG(dif) + dG, 'knowledge diffusion', 'test'); // F1: the diffused level D above the effective recipe by dG
  softwareProgressDay(dif);
  const dPub = (dif.player.research.pubRate ?? 0) - (ref.player.research.pubRate ?? 0);
  check(Math.abs(rate(dif) - rate(ref)) < 1e-12 && Math.abs(dPub - dG / 14) < 1e-12 && softwareRate(dif).publicPerYear > softwareRate(ref).publicPerYear,
    'RD-B16: a diffusion inflow does not move Software progress; it shows as public knowledge (its own 14-day average)',
    `rate ${(365 * rate(dif)).toFixed(4)} OOM/yr (unchanged); public +${(365 * dPub).toFixed(3)} OOM/yr`);
  // An adopted idea does count: all of x enters the day's change (RD-E03: no headroom).
  const ad = clone(s);
  const x = 0.02;
  addIdea(ad.player.research.stacks.pre, x, 0, latestBaseFlop(ad));
  softwareProgressDay(ad);
  const dRate = rate(ad) - rate(ref);
  check(Math.abs(dRate - x / 14) < 1e-9, 'RD-B16: an adopted idea moves Software progress by its whole effect (÷ the 14-day average)', `Δrate ${(365 * dRate).toFixed(4)} OOM/yr`);

  // (The RD-B16 check that theft and leaks compare recipes in one unit went with the old China recipe state: an NPC lab's know-how is read from its lag, npc/shocks.ts npcKnowhow.)

  // In the engine, a challenger's diffusion goes to public knowledge, not to Software progress: the old measure (every
  // change of the stacks' G at the latest base) reads far faster.
  const ch = newGame(defaultSetupV2({ world: 'tl-central', start: 'challenger', alignment: 'medium', seed: 2027, tutorial: false }));
  let pubMax = 0;
  let pubSum = 0;
  let pub0 = diffusedLift(ch);
  let gl: number | undefined;
  let old = ch.player.research.gRate ?? 0;
  runRef(ch, 200, (g) => {
    pubMax = Math.max(pubMax, g.player.research.pubRate ?? 0);
    pubSum += diffusedLift(g) - pub0;
    pub0 = diffusedLift(g);
    const x = stacksGEquiv(g);
    if (gl !== undefined) old += (Math.max(0, x - gl) - old) / 14;
    gl = x;
    return false;
  });
  // CP3: the "Software progress < half the old stack measure" check is deleted (RD-X04 / X04b: the daily distillation leak
  // it was sized against is gone; diffusion is the τ = 4 months recipe rule, checked in X04's own check).
  console.log(`      RD-B16 readout: public knowledge to day 200 +${pubSum.toFixed(3)} OOM (peak ${(365 * pubMax).toFixed(2)} OOM/yr); Software progress ${(365 * rate(ch)).toFixed(2)} OOM/yr, old measure ${(365 * old).toFixed(2)}`);
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
  s.player.split.routine += s.player.split.experiments;
  s.player.split.experiments = 0;
  for (let d = 0; d < 200; d++) tick(s, { skip: ['endings'] });
  const t1 = s.player.tree['L.scale']?.cap?.test;
  check(tested && !!t1 && t1.c.k === t0?.c.k && s.player.tree['L.scale']?.cap?.stage === stage0 && t1.work <= w0 + 1e-9,
    'a stage without experiment FLOP waits', `${stage0}: work ${w0.toFixed(2)} → ${t1?.work.toFixed(2)} of ${t1?.workNeed.toFixed(2)}`);
}

// ---------- stacks: full effect at adoption (RD-E03), scale dependence ----------
{
  const st = initialStacks(0).pre;
  addIdea(st, 0.1, 0, 1e24);
  addIdea(st, 0.1, 0, 1e24);
  check(Math.abs(stackAt(st) - 0.2) < 1e-12, 'stacks: two adopted 0.1 OOM ideas add 0.2 OOM at once (no headroom)', stackAt(st).toFixed(4));
  // Scale dependence (SCALE-DIAG M1): a paradigm-tier idea (relative slope κ) adds x(1 + κ·log10(F/F_test)): linear in log F, so
  // two OOM of run FLOP add 2κx whatever the stock, and the slope per OOM does not grow with F.
  const st2 = initialStacks(0).pre;
  addIdea(st2, 0.1, 0.2, 1e24);
  const lin = Math.abs(stackAt(st2, 1e26) - 0.1 * (1 + 0.2 * 2)) < 1e-9 && Math.abs(stackAt(st2, 1e28) - stackAt(st2, 1e26) - (stackAt(st2, 1e26) - stackAt(st2, 1e24))) < 1e-9;
  check(lin && stackAt(st2, 1e24) === 0.1, 'stacks: a paradigm-tier idea grows linearly with log run FLOP (x(1 + κ log10(F/F_test)))', `${stackAt(st2, 1e24).toFixed(3)} at 1e24, ${stackAt(st2, 1e26).toFixed(3)} at 1e26, ${stackAt(st2, 1e28).toFixed(3)} at 1e28`);
  const st3 = initialStacks(0).pre;
  addIdea(st3, 0.1, 0, 1e24);
  check(stackAt(st3, 1e30) === 0.1, 'stacks: a routine idea is scale-invariant beyond its test scale', stackAt(st3, 1e30).toFixed(3));
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
      // fields (paAtStart) and cause bookkeeping (the change of the readout).
      if (/(player|\bp)\.pa\b(?!\s*=[^=])/.test(code) && !/paAtStart|const before = s\.player\.pa|s\.player\.pa - before/.test(code)) bad.push(`${name}:${i + 1}: ${line.trim()}`);
    });
  }
  check(bad.length === 0, 'lint: e_stack never comes from the know-how readout (no eStack/recipeAt; runs, stacks, research and effective do not read player.pa)', bad.slice(0, 4).join(' | '));
}

// ---------- model v3 D9: P10, P12, P21 are typed data / suite effects (no flat level bonuses) ----------
{
  const typed = ['P10', 'P21'].map((id) => ({ id, n: TREE_BY_ID[id] }));
  const want: Record<string, (e: NonNullable<TreeNodeDef['effect']>) => boolean> = {
    P10: (e) => (e.data?.synQMax ?? 0) > 0 && !e.data?.worthOom,
    P21: (e) => (e.data?.worthOom ?? 0) > 0 && !e.data?.synQMax,
  };
  const bad = typed.filter(({ id, n }) => !n.kind || !n.effect || n.effect.stack || n.effect.domains || !want[id](n.effect) || !hasTypedEffect(n)).map((x) => x.id);
  check(bad.length === 0, 'D9: P10, P12 and P21 are capability projects with typed effects (P10 synthetic-quality ceiling, P12 long-tasks expert data, P21 token worth); no stack, domain or cash-at-start flags',
    typed.map(({ id, n }) => `${id} ${n.kind} ${JSON.stringify(n.effect)}`).join('; '));
}

// ---------- RD-B17: honest Recipe readouts (B28 units, B29 counts, B30 who reveals) ----------
{
  const s = mk(7);
  const ctx = makeCtx(s);
  let k = 0;
  const adopt = (id: string, b = 1) => {
    const n = TREE_BY_ID[id] ?? PROJECT_BY_ID[id];
    const c = newCandidate(s, n, freshCap(), 1, b);
    const fTest = stagesOf(n).testFrac * latestBaseFlop(s);
    const buildId = `rdb17-${k++}`;
    const r = { c, xTest: 0.05, sHat: 0, fTest, est: 0.05, estSd: 0.01, day: s.time.day, buildId };
    s.player.tree[id] = { status: 'researching', progress: 1, cap: { ...freshCap(), ...(n.kind === 'line' ? { pending: [r] } : { stage: 'adopting' as const, result: r }) } };
    completeAdoption(s, ctx, id, buildId, () => {});
  };
  const total = () => STACK_KEYS.reduce((a, x) => a + s.player.research.stacks[x].n, 0);
  const n0 = total();
  adopt('P16');
  const nP16 = total() - n0;
  adopt('L.rlalg', 3);
  const nLine = total() - n0 - nP16;
  check(nP16 === 1 && nLine === 3 && s.player.research.stacks.serve.n === 0, 'RD-B17 ideas adopted count ideas: P16 (two stacks) counts 1, a batch of 3 counts 3',
    `P16 +${nP16}, batch of 3 +${nLine}, serving stack n ${s.player.research.stacks.serve.n}`);
  adopt('P09');
  adopt('P10');
  const gs = stackViews(s);
  const oth = otherEffectViews(s);
  const p09 = oth.find((x) => x.id === 'P09');
  const p10 = oth.find((x) => x.id === 'P10');
  check(gs.every((g) => g.ideas.every((a) => a.stack === g.key)) && !gs.some((g) => g.ideas.some((a) => a.id === 'P09' || a.id === 'P10')) && !!p09 && p09.rows.every((r) => r.unit === 'OOM for new versions') && !!p10 && p10.rows[0]?.unit === 'web text = 1',
    'RD-B17 P09 is not under pretraining: domain and data effects are listed apart, in their own units', `P09 rows ${p09?.rows.map((r) => `${r.label} ${r.unit}`).join(', ')}; P10 ${p10?.rows.map((r) => `${r.label} ${r.unit}`).join(', ')}`);
  const keys = gs.map((g) => g.key);
  // CP4: the Recipe panel is gone (UB-8): RESEARCH › Know-how (KnowHow.tsx) is its home; it may count ideas, but no card
  // sums a stack's level or OOM values.
  const src = readFileSync(join(HERE, '../../src/ui/v2/panels/KnowHow.tsx'), 'utf8');
  check(keys.length === STACK_KEYS.length && new Set(keys).size === keys.length && gs.every((g) => Math.abs(g.now - (s.player.research.stacks[g.key].base + (s.player.research.stacks[g.key].est ?? 0))) < 1e-12) && !/\.reduce\([^\n]*\b(now|oom|dG|base|est)\b/.test(src),
    'RD-B17 no know-how card sums mixed units: one card per stack, no level / OOM sums in the panel', keys.join(', '));
  // B30: which model first embodies an RL idea (RF-R5: the idea names it; its measured gain is the model's).
  const day = s.time.day;
  const vs = s.player.models.versions;
  const proto = vs[vs.length - 1];
  const add = (id: string, extra: Partial<typeof proto>) => vs.push({ ...proto, id, name: id, day: day + 10, status: 'ready', ...extra });
  const rl = () => stackViews(s).find((g) => g.key === 'rlMid')!.ideas.find((a) => a.id === 'L.rlalg')!;
  add('Tmini', { variant: 'mini', trained: undefined });
  const afterMini = rl().seenIn;
  add('Told', { variant: 'full', trained: { rlDay: day - 5, post: true } });
  const afterOld = rl().seenIn;
  add('Tnew', { variant: 'full', trained: { rlDay: day + 1, post: true } });
  const after = rl();
  check(afterMini === undefined && afterOld === undefined && after.seenIn === 'Tnew',
    'RD-B17 a distill (or a post-train launched before it) does not reveal an RL idea; a post-train launched after does', `mini ${afterMini}, earlier launch ${afterOld}, later seen in ${after.seenIn}`);
}


// ---------- RD-B18: research previews are what the engine runs (B31 one ETA / effort, B35 action previews) ----------
{
  const fx = (d: number) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
  const cl = (x: GameStateV2) => deserialize(serialize(x));
  const pv = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}) => ACTION_BY_ID.get(id)!.preview(s, p);
  const apply = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}) => ACTION_BY_ID.get(id)!.apply(s, makeCtx(s), p);
  // B31 effort: from the stages the engine runs, not the class table.
  const sum = (n: TreeNodeDef) => { const e = effortOfNode(n); return e.sci + e.exp; };
  const p17 = PROJECT_BY_ID.P17;
  const p17c = pv(fx(400), 'research.queue', { id: 'P17' }).costs.filter((c) => c.currency === 'staffTime').map((c) => c.amount);
  const line = PROJECT_BY_ID['L.scale'];
  const saf = PROJECT_BY_ID['T-CONFESS'];
  const safC = pv(fx(400), 'research.queue', { id: 'T-CONFESS' }).costs.filter((c) => c.currency === 'staffTime');
  check(Math.abs(p17c[0] - Math.round(PICK_AT * stagesOf(p17).idea * 10) / 10) < 1e-9 && Math.abs(p17c[1] - Math.round((stagesOf(p17).small + stagesOf(p17).scale) * 10) / 10) < 1e-9 && effortClassOf(p17) === 'XL'
    && Math.abs(sum(line) - (PICK_AT * 0.8 + 1.8)) < 1e-9 && safC.length === 1 && safC[0].unit === 'months' && Math.abs(safC[0].amount - AGENDA_BY_ID[saf.agenda as AgendaId].T1) < 0.051,
    'RD-B18 effort readouts run on the engine\'s stages: P17 science / experiment team-months from its fitted effort, a line its line stages, a safety line T₁ months',
    `P17 ${p17c.join(' / ')} (class ${effortClassOf(p17)}); L.scale ${sum(line).toFixed(2)}; T-CONFESS ${safC.map((c) => `${c.amount} ${c.unit}`).join(', ')} (T₁ ${AGENDA_BY_ID[saf.agenda as AgendaId].T1})`);
  // B31 one ETA: the Projects card, the tree and the previews read capEta; one engine day takes a day off it at the
  // inputs that day ran on (the next day's experiment compute can differ: read with the day's own readout).
  const s = fx(400);
  const ids = s.player.research.queue.filter((id) => isCapProject(PROJECT_BY_ID[id]));
  const same = ids.every((id) => { const v = capProjectView(s, id)!; return v.state === 'adopting' || Math.abs(projectEta(s, id) - (v.etaParts.ideation + v.etaParts.experiments)) < 1e-9 || (!Number.isFinite(v.eta) && !Number.isFinite(projectEta(s, id))); });
  const t1 = cl(s);
  tick(t1, { skip: ['endings'] });
  const drift: string[] = [];
  let close = 0;
  let n = 0;
  const h = cl(s);
  h.player.research.last = t1.player.research.last;
  for (const id of ids) {
    const a = capEta(h, id);
    const b = capEta(t1, id);
    const sa = s.player.tree[id]?.cap;
    const sb = t1.player.tree[id]?.cap;
    if (!Number.isFinite(a.eta) || !Number.isFinite(b.eta) || a.eta < 3 || !sa || !sb || sa.stage !== sb.stage || !!sa.test !== !!sb.test || sa.cands.length !== sb.cands.length || (sa.test && sb.test && sa.test.c.k !== sb.test.c.k)) continue;
    n++;
    const err = Math.abs(a.eta - 1 - b.eta);
    if (err < Math.max(0.05, 0.02 * a.eta)) close++;
    drift.push(`${id} ${a.eta.toFixed(1)}→${b.eta.toFixed(1)}`);
  }
  check(same && n > 0 && close === n, 'RD-B18 one capability ETA: Projects card = projectEta (tree, Assign / Take off); one engine day takes one day off it', `${close}/${n}: ${drift.join(', ')}`);
  // B35 Assign / Take off: the days are those of a copy with the team moved (a project in ideation, where science
  // teams set the pace: its candidates reset on a copy of the fixture).
  {
    const base = cl(s);
    const sciT = base.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap' && t.projectId);
    const team = sciT[0];
    const to = sciT.find((t) => t.projectId !== team?.projectId)?.projectId;
    if (team && to) {
      base.player.tree[to].cap = freshCap();
      const from = team.projectId!;
      const r = (x: number) => (Number.isFinite(x) ? Math.round(x) : NaN);
      const g = pv(base, 'research.assign', { id: to, team: team.id });
      const c = cl(base);
      apply(c, 'research.assign', { id: to, team: team.id });
      const want = r(capEta(base, to).eta) - r(capEta(c, to).eta);
      const fromLate = r(capEta(c, from).eta) - r(capEta(base, from).eta);
      const u = pv(base, 'research.unassign', { team: team.id });
      const cu = cl(base);
      apply(cu, 'research.unassign', { team: team.id });
      const late = r(capEta(cu, from).eta) - r(capEta(base, from).eta);
      const gotFrom = g.costs.find((x) => x.currency === 'leadDays')?.amount ?? 0;
      const gotLate = u.costs[0].amount;
      check(want > 0 && g.gains[0].amount === want && (Number.isNaN(fromLate) ? /stalls/.test(String(g.costs[1]?.target)) : -gotFrom === fromLate) && (Number.isNaN(late) ? /stalls/.test(String(u.costs[0].target)) : -gotLate === late),
        'RD-B18 Assign / Take off previews = the ETA change of a copy with the team moved', `assign ${g.gains[0].amount} vs ${want} d sooner; from ${gotFrom} vs ${fromLate}; take off ${gotLate} vs ${late} (${u.costs[0].target})`);
    } else check(false, 'RD-B18 Assign / Take off previews = the ETA change of a copy with the team moved', 'fewer than two capability projects with teams in the day-400 fixture');
  }
  // B35 Reorder: the lines are each project's ETA change on a copy where the order is applied.
  {
    const last = ids[ids.length - 1];
    const m = pv(s, 'research.move', { id: last, to: 0 });
    const c = cl(s);
    apply(c, 'research.move', { id: last, to: 0 });
    const fin = (id: string) => Number.isFinite(capEta(s, id).eta) && Number.isFinite(capEta(c, id).eta);
    const stalls = ids.filter((id) => Number.isFinite(capEta(s, id).eta) !== Number.isFinite(capEta(c, id).eta)).length;
    const want = ids.filter(fin).map((id) => Math.round(capEta(s, id).eta) - Math.round(capEta(c, id).eta)).filter((d) => d !== 0).sort((a, b) => a - b);
    const lines = [...m.gains, ...m.costs].filter((l) => l.amount !== 0);
    const got = lines.filter((l) => / (sooner|later)$/.test(String(l.target))).map((l) => l.amount).sort((a, b) => a - b);
    const gotStalls = lines.filter((l) => /stalls|gets going/.test(String(l.target))).length;
    const words = JSON.stringify(m);
    check(JSON.stringify(want) === JSON.stringify(got) && stalls === gotStalls && !/idle teams follow/.test(words), 'RD-B18 Reorder preview = each capability project\'s ETA change after the re-plan on a copy (no "idle teams follow")', `preview ${got.join(', ')} (${gotStalls} start / stall) vs copy ${want.join(', ')} (${stalls})`);
  }
  // B35 Reopen: the speculative attempt's own preview (lower prior, half the odds), as the reopened copy shows it; no
  // "+0.05 progress"; Research risk shows no κ as progress.
  {
    const c = cl(s);
    const id = 'P09';
    c.player.tree[id] = { status: 'failed', progress: 0, attempts: 1, cap: { ...freshCap(), stage: 'failed' } };
    const r = pv(c, 'research.reopen', { id });
    const d = cl(c);
    apply(d, 'research.reopen', { id });
    const after = pv(d, 'research.queue', { id });
    const gl = (p: { gains: { amount: number; probability?: number }[] }) => JSON.stringify(p.gains.map((x) => [x.amount, x.probability]));
    const risky = ['safe', 'balanced', 'speculative'].map((k) => pv(c, 'research.risk', { risk: k })).flatMap((p) => [...p.costs, ...p.gains]).filter((l) => l.currency === 'progress' && l.amount !== 0);
    check(gl(r) === gl(after) && !r.gains.some((x) => x.amount === 0.05) && r.gains.every((x) => !!x.unit) && risky.length === 0,
      'RD-B18 Reopen preview = the reopened copy\'s own preview (prior and odds of the speculative attempt); Research risk shows no κ as progress', `reopen ${gl(r)} vs copy ${gl(after)}; risk progress lines ${risky.length}`);
  }
}

check(PICK_AT >= 2, 'fixture: teams choose among at least two candidates');
finish('research');
