// Model v3 F1 tests: rivals, China and the leader lab in effective compute (design/V3-TASKS.md F1, design/notes/F1.md).
// Owner: WS1/WS4.
//   R1  a rival's recipe grows with its research inputs (compute, staff) and its G with its compute
//   R2  base releases on the archetype cadence (9–15 months, research/12 §0.1), post-training versions every 6–10 weeks
//   R3  FLOP per token from the lab's own base (2·N_active, N = √(FLOP/(6·tpp))), not from its G
//   R4  a fixed physical rival run gives the same G whatever the date
//   R5  the start state: each lab's start model is its drawn start model; the leader lab's recipe is the leader's day-0
//       recipe (e ≈ 0); at the leader's day-0 inputs the pretraining part grows at PRE_RATE0, the RL parts by their shares
//   R6  milestones are λ(G) crossings of the level knots (one map for every lab)
//   R7  lint: no BRIDGE(V7), simpleLag / simpleCredit, CAL_SHIFT or calShift / pm thresholds, fptOfG or the G cap in rival code
//   INFO the leader lab's G path (passive player, ai2027) vs research/12's frontier anchors
//   R8  (F2) a follower's start base is stale by its own day-0 recipe growth (the leader lab: the reference rates, B0 itself)
//   R9  (F2) the lead before the level history reaches back: the start gap at the pre-game frontier rate + days since
//   INFO (F2, `--ref`) the recipe law at RefBot's own inputs vs RefBot's stack growth, days 600–860
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { POST_DAYS, PRE_RATE0, RIVAL_TPP } from '../../src/data/v2/rivalModel';
import { PARAM_RANGE, SHAPE } from '../../src/data/v2/runDesign';
import {
  bestGOf, evalAggregate, fptOfBase, gOfSimple, lineScaleFactor, makeBase, postG, recipeOf, recipeParts, recipeRates, versionG,
} from '../../src/engine/v2/actors/rivalModel';
import { rivalResearch } from '../../src/engine/v2/production/production';
import { gV0, levelOfG } from '../../src/engine/v2/models/capability';
import { paramsForFlop } from '../../src/engine/v2/models/effective';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import { decimalYear } from '../../src/engine/v2/core/time';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';
import { HERE, check, finish, refGame, runRef } from './lib';
import { B0_START_DAY } from '../../src/data/v2/calibration';
import { bestRivalMix } from '../../src/engine/v2/actors/rivalModel';
import { leadBetween } from '../../src/engine/v2/actors/rivals';
import { agentVersion } from '../../src/engine/v2/departments/agents';
import { gOfBuild, playerStart } from '../../src/engine/v2/models/capability';
import { bestPm } from '../../src/engine/v2/models/labs';
import { latestBaseFlop, refRlGain, rlCeilNow, rlMidNow, stacksGEquiv } from '../../src/engine/v2/models/stacks';
import { linePool } from '../../src/engine/v2/models/research';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { poolsOf } from '../../src/engine/v2/compute/power';
import { referenceRate } from '../../src/engine/v2/world/calibration';

const mk = (seed = 2027, leaderLab = true): GameStateV2 => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed, tutorial: false, leaderLab }));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// ───────── R1: recipe grows with research inputs; G with compute ─────────
{
  const s = mk();
  const r = s.rivals[0];
  const w = s.hidden.timeline;
  const base = rivalResearch(s, r, false);
  const big = clone(r);
  big.core.computeOnline *= 2;
  const more = clone(r);
  more.core.staff.cap *= 2;
  const rate = (x: RivalLab) => rivalResearch(s, x, false).rate;
  check(rate(big) > base.rate && rate(more) > base.rate, 'R1 recipe growth rises with the lab\'s research compute and with its staff',
    `progress-yr/yr ${base.rate.toFixed(3)} → ×2 compute ${rate(big).toFixed(3)}, ×2 staff ${rate(more).toFixed(3)}`);
  // The same lab further down its pretraining pool grows slower there (the part's returns r_pre = 0.8·r: each OOM at
  // test scale needs 10^(1/r_pre) more input); public knowledge (the stack base) does not make ideas harder.
  const P = recipeParts();
  const ahead = clone(r);
  ahead.phys.pool.pre += 1;
  const pub = clone(r);
  pub.phys.rec.pre += 1;
  const pre = (x: RivalLab) => recipeRates(w, x.phys, 1).rec.pre;
  check(near(pre(ahead) / pre(r), Math.pow(10, -1 / (P.pre.w * w.v3.r)), 1e-9) && near(pre(pub), pre(r), 1e-12), 'R1 ideas get harder: one OOM further down the pretraining pool divides its rate by 10^(1/(0.8·r)); public knowledge does not', `${(pre(ahead) / pre(r)).toFixed(4)} vs ${Math.pow(10, -1 / (P.pre.w * w.v3.r)).toFixed(4)}`);
  // A base trained on twice the pool is 0.30 OOM more training FLOP: its G_pre is log₁₀ 2 higher (+ the shape term of
  // the tokens per parameter, unchanged), its versions too.
  const REC = { pre: 0.5, mid: 0.3, ceil: 0.1 };
  const b1 = makeBase(2, 100, 1e27, 0.3);
  const b2 = makeBase(2, 100, 2e27, 0.3);
  check(near(b2.gPre - b1.gPre, Math.log10(2), 1e-9) && postG(b2, REC) > postG(b1, REC), 'R1 a base on twice the training FLOP gains log₁₀ 2 of G_pre (and its versions gain at least that)', `${(b2.gPre - b1.gPre).toFixed(4)} OOM; version +${(postG(b2, REC) - postG(b1, REC)).toFixed(4)}`);
  // In play: two copies of a world, one rival with twice the compute for a year.
  const sa = mk(11, false);
  const sb = clone(sa);
  const ra = sa.rivals[0];
  const rb = sb.rivals[0];
  for (let d = 0; d < 365; d++) {
    rb.core.computeOnline = 2 * ra.core.computeOnline;
    tick(sa, { skip: ['endings'] });
    rb.core.computeOnline = 2 * ra.core.computeOnline;
    tick(sb, { skip: ['endings'] });
  }
  check(gOfSimple(sb.hidden.timeline, rb.internal) > gOfSimple(sa.hidden.timeline, ra.internal) && recipeOf(sb, rb) > recipeOf(sa, ra),
    'R1 over a year a rival with twice the compute ends with a better recipe and a better model', `G ${gOfSimple(sa.hidden.timeline, ra.internal).toFixed(2)} → ${gOfSimple(sb.hidden.timeline, rb.internal).toFixed(2)}; e ${recipeOf(sa, ra).toFixed(2)} → ${recipeOf(sb, rb).toFixed(2)}`);
}

// ───────── R2: cadence ─────────
{
  const s = mk(5);
  const gens: Record<string, Set<string>> = {};
  const posts: Record<string, number[]> = {};
  const lastId: Record<string, string> = {};
  for (let d = 0; d < 730; d++) {
    tick(s, { skip: ['endings'] });
    for (const r of [...s.rivals, s.china.lab]) {
      const id = r.core.id;
      const m = /-b(\d+)p(\d+)$/.exec(r.internal.id);
      if (m) (gens[id] ??= new Set()).add(m[1]);
      if (lastId[id] !== undefined && lastId[id] !== r.internal.id) (posts[id] ??= []).push(s.time.day);
      lastId[id] = r.internal.id;
    }
  }
  const rows: string[] = [];
  let ok = true;
  for (const r of [...s.rivals, s.china.lab]) {
    const n = gens[r.core.id]?.size ?? 0; // bases seen in two years, the start base included
    const p = posts[r.core.id] ?? [];
    const gaps = p.slice(1).map((x, i) => x - p[i]);
    const maxGap = gaps.length ? Math.max(...gaps) : 0;
    if (n < 2 || n > 4 || maxGap > POST_DAYS[1] + 1) ok = false;
    rows.push(`${r.core.id} ${r.archetype}: ${n} bases, ${p.length} new versions, longest gap ${maxGap} d`);
  }
  check(ok, 'R2 bases on the 9–15-month cadence (2–4 in two years incl. the start base), a new version at least every 10 weeks', rows.join('; '));
}

// ───────── R3: FLOP per token from the lab's own base ─────────
{
  const s = mk();
  const w = s.hidden.timeline;
  let ok = true;
  const rows: string[] = [];
  for (let d = 0; d < 400; d++) tick(s, { skip: ['endings'] });
  for (const r of [...s.rivals, s.china.lab]) {
    const m = r.internal;
    const N = Math.min(PARAM_RANGE[1], Math.max(PARAM_RANGE[0], paramsForFlop(m.flop ?? 0, r.phys.base.tpp)));
    if (!near(m.params ?? 0, N, 1e-9) || !near(m.fpt ?? 0, 2 * N * SHAPE.moe.tokenMult, 1e-9)) ok = false;
    rows.push(`${r.core.id} G ${gOfSimple(w, m).toFixed(2)} FLOP ${(m.flop ?? 0).toExponential(1)} N ${((m.params ?? 0) / 1e12).toFixed(2)}T`);
  }
  // Two versions on one base with different G serve at the same FLOP per token.
  const b = makeBase(3, 0, 5e27, 0.5, RIVAL_TPP);
  check(fptOfBase(b) === 2 * b.params * SHAPE.moe.tokenMult && versionG(b, 0.1, 0) !== versionG(b, 0.4, 0), 'R3 a version\'s FLOP per token is its base\'s 2·N_active, whatever its G');
  check(ok, 'R3 every rival model serves at 2·N_active of its own base, N_active = √(FLOP/(6·tpp))', rows.join('; '));
}

// ───────── R4: a fixed physical run gives the same G whatever the date ─────────
{
  const a = makeBase(2, 100, 3e27, 0.4);
  const b = makeBase(2, 1500, 3e27, 0.4);
  const s1 = mk(3);
  const s2 = mk(3);
  for (let d = 0; d < 600; d++) tick(s2, { skip: ['endings'] });
  const r1 = s1.rivals[0];
  const r2 = s2.rivals[0];
  // The same recipe (know-how) and base in both labs: the version they post-train is the same G on any day.
  r2.phys.rec = clone(r1.phys.rec);
  r2.phys.base = clone(r1.phys.base);
  const g1 = postG(r1.phys.base, r1.phys.rec);
  const g2 = postG(r2.phys.base, r2.phys.rec);
  check(a.gPre === b.gPre && versionG(a, 0.1, 0.05) === versionG(b, 0.1, 0.05) && g1 === g2, 'R4 a fixed physical run (FLOP, tokens per parameter, recipe) gives the same G on day 100 and day 1500, and in a game on day 0 and day 600', `${a.gPre.toFixed(3)}; ${g1.toFixed(3)} = ${g2.toFixed(3)}`);
}

// ───────── R5: start state and the recipe law ─────────
{
  const s = mk();
  const w = s.hidden.timeline;
  const L = s.rivals.find((r) => r.core.id === LEADER_ID)!;
  const e0 = recipeOf(s, L);
  check(Math.abs(e0) < 0.05 && near(gOfSimple(w, L.internal), gV0(w), 1e-9), 'R5 the leader lab starts at V0 with the leader\'s day-0 recipe (|e| < 0.05 OOM)', `e₀ ${e0.toFixed(4)}`);
  let ok = true;
  for (const r of [...s.rivals, s.china.lab]) if (!near(r.internal.G ?? NaN, postG(r.phys.base, r.phys.rec), 0.05)) ok = false;
  check(ok, 'R5 every lab\'s start model is a version on its start base (within the start post\'s staleness)');
  // At the leader's day-0 inputs (V0, 2,050 staff, the day-0 experiment and agent compute) rs = 1.
  const x = evalAggregate(w, gV0(w), 2e12 * SHAPE.moe.tokenMult, 2050, 0.625, 8e4, 1, 1);
  const v = recipeRates(w, { rec: L.phys.rec, pool: { pre: 0, mid: 0, ceil: 0 } }, x.rs).rec;
  check(near(x.rs, 1, 1e-9) && near(v.pre, PRE_RATE0, 1e-9) && near(v.mid / v.ceil, 0.08 / 0.12, 1e-9), 'R5 at the leader\'s day-0 inputs research speed is 1, the pretraining part grows at PRE_RATE0 and the RL parts by their shares', `rs ${x.rs.toFixed(6)} (E ${x.E.toFixed(3)}, I ${x.I.toFixed(3)}); pre ${v.pre.toFixed(3)}, mid ${v.mid.toFixed(3)}, ceil ${v.ceil.toFixed(3)} OOM/yr`);
  // κ: the scale factor of the reference lines' results, from their scale priors and the survival rule (design/notes/F2.md).
  const P = recipeParts();
  const k = [lineScaleFactor(0.05, 0.04), lineScaleFactor(0, 0.05), lineScaleFactor(-0.25, 0.2), lineScaleFactor(0, 0)];
  check(near(k[0], 1.507, 2e-3) && near(k[1], 1.175, 2e-3) && near(k[2], 2.099, 2e-3) && k[3] === 1 && near(P.pre.kappa, (0.36 * k[0] + 0.22 * k[1] + 0.22 * k[2]) / 0.8, 1e-9) && P.mid.kappa === 1 && P.ceil.kappa === 1,
    'R5 κ_pre is the rShare-weighted scale factor of the pretraining lines (1.507 / 1.175 / 2.099), the RL parts 1', `κ_l ${k.map((y) => y.toFixed(3)).join(' / ')}; κ_pre ${P.pre.kappa.toFixed(3)}; w ${P.pre.w.toFixed(2)} / ${P.mid.w.toFixed(2)} / ${P.ceil.w.toFixed(2)}`);
}

// ───────── R6 + INFO: milestones from λ(G); the leader's G path ─────────
{
  const s = mk();
  const w = s.hidden.timeline;
  const L = s.rivals.find((r) => r.core.id === LEADER_ID)!;
  const firstAt: Record<number, number> = {};
  const path: string[] = [];
  const anchors: [string, number, number][] = [['2025-08-15', 45, 28.0], ['2025-11-15', 137, 28.4], ['2026-02-15', 229, 28.7], ['2026-04-15', 288, 29.0], ['2026-10-15', 471, 29.4]];
  while (s.time.day < 700) {
    tick(s, { skip: ['endings'] });
    const L0 = levelOfG(w, bestGOf(w, L));
    for (let i = 0; i < LEVEL_KNOTS.length; i++) if (firstAt[i] === undefined && L0 >= LEVEL_KNOTS[i] - 1e-9) firstAt[i] = s.time.day;
    const a = anchors.find((x) => x[1] === s.time.day);
    if (a) path.push(`${a[0]} G ${bestGOf(w, L).toFixed(2)} (anchor ${a[2]})`);
  }
  let ok = true;
  // The milestones system (order 50) sees a version the labs' cadence (order 100) made the day before.
  for (const [k, d] of Object.entries(L.core.milestoneDays)) if (Number(k) > 0 && !((d as number) - firstAt[Number(k)] >= 0 && (d as number) - firstAt[Number(k)] <= 1)) ok = false;
  check(ok && L.core.milestoneDays[3] !== undefined, 'R6 rival milestones are the days λ(best G) first reaches the level knots (recorded the next morning)', `${JSON.stringify(L.core.milestoneDays)} vs ${JSON.stringify(firstAt)}`);
  console.log(`INFO  leader lab G path (passive player, ai2027, seed 2027; research/12 §0.2 anchors): ${path.join('; ')}; y ${decimalYear(s).toFixed(2)}`);
}

// ───────── R8 (F2): a follower's start base is stale by its own recipe growth ─────────
{
  const s = mk(4, false);
  let ok = true;
  const rows: string[] = [];
  for (const r of [...s.rivals, s.china.lab]) {
    // Its day-0 pretraining growth at the best research mix (one applied day on a copy: the first day re-splits to it).
    const c = clone(r);
    rivalResearch(s, c, true);
    const rate = (c.phys.rec.pre - r.phys.rec.pre) * 365;
    // The start base's pretraining recipe is today's less that growth over the days since the base's launch.
    const want = r.phys.rec.pre - (rate * -B0_START_DAY) / 365;
    if (!near(r.phys.base.ePre, want, 2e-3)) ok = false;
    rows.push(`${r.core.id} e_pre ${r.phys.rec.pre.toFixed(3)} rate ${rate.toFixed(2)} OOM/yr ePre ${r.phys.base.ePre.toFixed(3)} (want ${want.toFixed(3)})`);
  }
  check(ok, 'R8 a follower\'s start base is as stale as its own day-0 recipe growth makes it (not the leader\'s reference rates)', rows.join('; '));
}

// ───────── R9 (F2): the lead before the history reaches back ─────────
{
  // Seed 4: DeepCent's first new base is due on day 194, so it has no new base in the first two months; the lead is
  // then the start gap plus the days since the start (the pre-game frontier line), not gap ÷ a few weeks' research rate.
  const s = mk(4, false);
  tick(s, { skip: ['endings'] });
  const l0 = leadBetween(s, 'player', 'china');
  const at: number[] = [];
  while (s.time.day < 60) {
    tick(s, { skip: ['endings'] });
    if (s.time.day % 30 === 0) at.push(leadBetween(s, 'player', 'china') - l0);
  }
  const gap0 = ((playerStart(s.hidden.timeline).target - bestPm(mk(4, false), 'china')) / referenceRate(s.hidden.timeline, playerStart(s.hidden.timeline).target, 2025.5)) * 365;
  // China's versions still add a little (the RL share of its recipe growth, fed by the know-how leaks), so the lead
  // grows at most a day a day and does not jump (v2's fallback read 390–450 d in days 30–60).
  check(Math.abs(l0 - gap0 - 1) <= 2 && at.every((x, i) => x <= 30 * (i + 1) + 1 && x >= -30), 'R9 in the first weeks China\'s lead is its start gap at the pre-game frontier rate plus at most the days since', `day 1 ${l0.toFixed(0)} d (gap ${gap0.toFixed(0)} d); +${at.map((x) => x.toFixed(0)).join(', +')} d at days 30, 60`);
}

// ───────── INFO (F2, `--ref`): the rivals' recipe law at the reference lab's own inputs ─────────
// RefBot (stub, ai2027, seed 2027): integrate the rivals' recipe law (three parts) at RefBot's own internal model, staff,
// research compute and research state (its lines' test-scale pools per part, its RL stacks) over days 600–860 and compare
// with what RefBot's stacks gained; the RL parts' G at RefBot's latest base, as its stacks' readout.
if (process.argv.includes('--ref')) {
  const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027 }));
  const w = s.hidden.timeline;
  const P = recipeParts();
  const u = (x: GameStateV2, ids: string[]) => ids.reduce((a, id) => { const pl = linePool(x, TREE_BY_ID[id]); return a + pl.r * Math.log10((pl.n0 + (x.player.tree[id]?.cap?.pool ?? 0)) / pl.n0); }, 0);
  let pred = 0;
  let g600 = 0;
  let g860 = 0;
  runRef(s, 861, (x) => {
    const d = x.time.day;
    const v = agentVersion(x, 'capRoutine');
    if (d === 600) g600 = stacksGEquiv(x);
    if (d === 860) g860 = stacksGEquiv(x);
    if (v?.build && d >= 600 && d < 860) {
      const G = gOfBuild(v.build);
      const fpt = v.fpt ?? 4e12;
      const pools = poolsOf(x);
      const C = pools.experiments + pools.agents;
      const a = evalAggregate(w, G, fpt, x.player.staff.cap, bestRivalMix(w, G, fpt, x.player.staff.cap, C), C, 1, 1);
      const pool = { pre: u(x, ['L.scale', 'L.data', 'L.opt']), mid: u(x, ['L.rlalg']), ceil: u(x, ['L.env']) };
      const F = latestBaseFlop(x);
      const mid = rlMidNow(x);
      const ceil = rlCeilNow(x);
      const rt = recipeRates(w, { rec: { pre: 0, mid, ceil }, pool }, a.rs).rec;
      const h = 1 / 365;
      pred += rt.pre * h + (refRlGain(F, mid + rt.mid * h, ceil + rt.ceil * h) - refRlGain(F, mid, ceil));
    }
    return false;
  });
  console.log(`INFO  days 600–860, ai2027 seed 2027: RefBot's stacks +${(g860 - g600).toFixed(2)} OOM; the rivals' recipe law at RefBot's own inputs and research state +${pred.toFixed(2)} OOM (κ_pre ${P.pre.kappa.toFixed(3)})`);
}

// ───────── R7: lint ─────────
{
  const root = join(HERE, '..', '..', 'src');
  const rival = ['engine/v2/actors/rivals.ts', 'engine/v2/actors/china.ts', 'engine/v2/actors/rivalModel.ts', 'engine/v2/worldfx/mix.ts', 'engine/v2/worldfx/serving.ts', 'data/v2/rivalModel.ts'];
  const bad: string[] = [];
  for (const f of rival) {
    readFileSync(join(root, f), 'utf8').split('\n').forEach((line, i) => {
      if (/BRIDGE\(V7\)/.test(line)) bad.push(`${f}:${i + 1} BRIDGE(V7)`);
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*\*?.*?(\*\/|$)/, '').replace(/^\s*\*.*$/, '');
      if (/\b(simpleLag|simpleCredit|simpleFrontierPm|simpleStartPa|simplePaFor|trainScaleTerm|CAL_SHIFT\w*|calShift|thresholds|capIndexV2|fptOfG|marketModel|RIVAL_ALGO_OOM_PER_YEAR|knotAt|multiplierAt)\b/.test(code)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  // Anywhere in the engine and data: the v2 simple-lab lag model is gone (the save migration may delete its fields).
  const walk = (d: string, out: string[]) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(p)) out.push(p); } return out; };
  for (const f of walk(root, [])) {
    const rel = relative(root, f).replace(/\\/g, '/');
    if (rel === 'engine/v2/core/save.ts') continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*\*?.*?(\*\/|$)/, '').replace(/^\s*\*.*$/, '');
      if (/\b(simpleLag|simpleCredit|simpleFrontierPm|simpleStartPa|simplePaFor|trainScaleTerm|lagCal|CAL_SHIFT_V2|fptOfG|marketModel)\b/.test(code)) bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  check(bad.length === 0, 'R7 lint: no BRIDGE(V7), v2 lag model (simpleLag, simpleCredit, LEADER lag), CAL_SHIFT / calShift / pm thresholds, knots or the old rival FLOP bridge in rival code', bad.slice(0, 6).join(' | '));
}

finish('rivals');
