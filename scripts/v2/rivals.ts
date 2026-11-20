// Model v3 F1 tests: rivals, China and the leader lab in effective compute (design/V3-TASKS.md F1, design/notes/F1.md).
// Owner: WS1/WS4.
//   R1  a rival's recipe grows with its research inputs (compute, staff) and its G with its compute
//   R2  base releases on the archetype cadence (9–15 months, research/12 §0.1), post-training versions every 6–10 weeks
//   R3  FLOP per token from the lab's own base (2·N_active, N = √(FLOP/(6·tpp))), not from its G
//   R4  a fixed physical rival run gives the same G whatever the date
//   R5  the start state: each lab's start model is its drawn start model; the leader lab's recipe is the leader's day-0
//       recipe (e ≈ 0); at the leader's day-0 inputs the recipe grows at RECIPE_RATE0
//   R6  milestones are λ(G) crossings of the level knots (one map for every lab)
//   R7  lint: no BRIDGE(V7), simpleLag / simpleCredit, CAL_SHIFT or calShift / pm thresholds, fptOfG or the G cap in rival code
//   INFO the leader lab's G path (passive player, ai2027) vs research/12's frontier anchors
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { POST_DAYS, RECIPE_RATE0, RIVAL_TPP } from '../../src/data/v2/rivalModel';
import { PARAM_RANGE, SHAPE } from '../../src/data/v2/runDesign';
import {
  bestGOf, evalAggregate, fptOfBase, gOfSimple, makeBase, postG, recipeOf, recipeRate, versionG,
} from '../../src/engine/v2/actors/rivalModel';
import { rivalResearch } from '../../src/engine/v2/production/production';
import { gV0, levelOfG } from '../../src/engine/v2/models/capability';
import { paramsForFlop } from '../../src/engine/v2/models/effective';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import { decimalYear } from '../../src/engine/v2/core/time';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';
import { HERE, check, finish } from './lib';

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
  // The same lab with a higher recipe grows slower (returns r: each OOM needs 10^(1/r) more input).
  const ahead = clone(r);
  ahead.core.pa += 1;
  check(rate(ahead) < base.rate && near(rate(ahead) / base.rate, Math.pow(10, -1.2 / w.v3.r), 1e-6), 'R1 ideas get harder: one progress-year more recipe divides the rate by 10^(B/r)', `${(rate(ahead) / base.rate).toFixed(4)} vs ${Math.pow(10, -1.2 / w.v3.r).toFixed(4)}`);
  // A base trained on twice the pool is 0.30 OOM more training FLOP: its G_pre is log₁₀ 2 higher (+ the shape term of
  // the tokens per parameter, unchanged), its versions too.
  const b1 = makeBase(2, 100, 1e27, 0.3);
  const b2 = makeBase(2, 100, 2e27, 0.3);
  check(near(b2.gPre - b1.gPre, Math.log10(2), 1e-9) && postG(b2, 0.5) > postG(b1, 0.5), 'R1 a base on twice the training FLOP gains log₁₀ 2 of G_pre (and its versions gain at least that)', `${(b2.gPre - b1.gPre).toFixed(4)} OOM; version +${(postG(b2, 0.5) - postG(b1, 0.5)).toFixed(4)}`);
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
  check(fptOfBase(b) === 2 * b.params * SHAPE.moe.tokenMult && versionG(b, 0.1) !== versionG(b, 0.4), 'R3 a version\'s FLOP per token is its base\'s 2·N_active, whatever its G');
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
  r2.core.pa = r1.core.pa;
  r2.phys.base = clone(r1.phys.base);
  const g1 = postG(r1.phys.base, recipeOf(s1, r1));
  const g2 = postG(r2.phys.base, recipeOf(s2, r2));
  check(a.gPre === b.gPre && versionG(a, 0.1) === versionG(b, 0.1) && g1 === g2, 'R4 a fixed physical run (FLOP, tokens per parameter, recipe) gives the same G on day 100 and day 1500, and in a game on day 0 and day 600', `${a.gPre.toFixed(3)}; ${g1.toFixed(3)} = ${g2.toFixed(3)}`);
}

// ───────── R5: start state and the recipe law ─────────
{
  const s = mk();
  const w = s.hidden.timeline;
  const L = s.rivals.find((r) => r.core.id === LEADER_ID)!;
  const e0 = recipeOf(s, L);
  check(Math.abs(e0) < 0.05 && near(gOfSimple(w, L.internal), gV0(w), 1e-9), 'R5 the leader lab starts at V0 with the leader\'s day-0 recipe (|e| < 0.05 OOM)', `e₀ ${e0.toFixed(4)}`);
  let ok = true;
  for (const r of [...s.rivals, s.china.lab]) if (!near(r.internal.G ?? NaN, postG(r.phys.base, recipeOf(s, r)) + 0, 0.05)) ok = false;
  check(ok, 'R5 every lab\'s start model is a version on its start base (within the start post\'s staleness)');
  // At the leader's day-0 inputs (V0, 2,050 staff, the day-0 experiment and agent compute) rs = 1.
  const x = evalAggregate(w, gV0(w), 2e12 * SHAPE.moe.tokenMult, 2050, 0.625, 8e4, 1, 1);
  check(near(x.rs, 1, 1e-9) && near(recipeRate(s, { ...L, core: { ...L.core, pa: L.core.pa - e0 / 1.2 } } as RivalLab, x.rs), RECIPE_RATE0, 1e-9), 'R5 at the leader\'s day-0 inputs research speed is 1 and the recipe grows at RECIPE_RATE0', `rs ${x.rs.toFixed(6)} (E ${x.E.toFixed(3)}, I ${x.I.toFixed(3)})`);
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
