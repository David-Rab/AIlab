// Model v3 V3 tests: work types, AI labour, research speed, milestones (design/V3-BUILD.md V3.7). Owner: WS1.
//   coverage is monotone in fit and horizon; copies ∝ compute ÷ FLOP per token; effective labour = humans when coverage
//   is 0; a line with constant inputs reproduces r; doubling project FLOP speeds a compute-bound experiment and not a
//   labour-bound one (and vice versa for labour); milestones fire in order SC → SAR → SIAR → ASI; a fixed lab's research
//   speed does not change with the calendar; the lint (no player mechanism reads the reference path or the knot tables).
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { engine } from '../../src/engine/v2/index';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { WORK_TYPES, REF_DELTA, TOP_SD } from '../../src/data/v2/workTypes';
import {
  copiesOf, coverage, effLabour, fitOf, flopPerToken, fteOfFpt, refPoints, sdAIOf, teamTaste, versionMilestones, workContext,
} from '../../src/engine/v2/departments/workfit';
import { linePool, poolMean, researchInputs } from '../../src/engine/v2/models/research';
import { Xces } from '../../src/engine/v2/production/ces';
import { bestPlayerVersion } from '../../src/engine/v2/models/labs';
import type { GameStateV2, ModelVersion } from '../../src/engine/v2/types';
import { buildCapacity } from '../../src/engine/v2/departments/teams';
import { engScale, runSetupTW, upkeepSplit } from '../../src/engine/v2/departments/build';
import { FIXTURE_DIR, HERE, check, finish, refGame, runRef } from './lib';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { effectLine, readState, type DayRead } from '../../src/engine/v2/departments/teamActions';
import { capShare } from '../../src/engine/v2/departments/agents';
import { nextSpecialty } from '../../src/engine/v2/departments/teams';
import { TEAM_SIZE } from '../../src/data/v2/teams';

const mk = (seed = 21, world: 'tl-central' | 'tl-fast' = 'tl-central'): GameStateV2 => newGame(defaultSetupV2({ world, alignment: 'medium', seed, tutorial: false }));

// ---------- coverage: monotone in fit and in horizon ----------
{
  const s = mk();
  const w = s.hidden.timeline;
  let monoFit = true;
  let monoH = true;
  for (const wt of ['SWE', 'EXP', 'IDEAS'] as const) {
    const best = refPoints(w, wt).best;
    let prev = -1;
    for (let f = best - 6; f <= best + 3; f += 0.1) {
      const a = coverage(w, wt, f, 1e4);
      if (a < prev - 1e-12) monoFit = false;
      prev = a;
    }
    prev = -1;
    for (let h = 10; h <= 1e7; h *= 1.5) {
      const a = coverage(w, wt, best, h);
      if (a < prev - 1e-12) monoH = false;
      prev = a;
    }
  }
  const lo = coverage(w, 'SWE', refPoints(w, 'SWE').best - 3, 203);
  const hi = coverage(w, 'SWE', refPoints(w, 'SWE').best, 1e5);
  check(monoFit && monoH && lo < 0.3 && hi > 0.9, 'coverage: monotone in fit and in the time horizon (0 far below the best human, ≈ 0.95 at the best human with a long horizon)', `SWE at G_SC − 3 OOM, h50 203 min: ${lo.toFixed(2)}; at G_SC, h50 1e5 min: ${hi.toFixed(2)}`);
}

// ---------- copies ∝ compute ÷ FLOP per token ----------
{
  const a = copiesOf(1e4, 2e12);
  const b = copiesOf(2e4, 2e12);
  const c = copiesOf(1e4, 4e12);
  check(Math.abs(b / a - 2) < 1e-9 && Math.abs(c / a - 0.5) < 1e-9 && Math.abs(fteOfFpt(4e12) / fteOfFpt(2e12) - 0.5) < 1e-9,
    'AI labour: copies and FTE ∝ compute ÷ FLOP per token', `${a.toFixed(0)} copies on 10k H100e at 2e12 FLOP/token; ×2 compute ${b.toFixed(0)}, ×2 FLOP/token ${c.toFixed(0)}`);
  const s = mk();
  const v0 = s.player.models.versions[0];
  check(Math.abs(flopPerToken(s, v0) - 2 * s.player.models.bases[0].params) / flopPerToken(s, v0) < 1e-9, 'AI labour: the start model serves at 2·N_active FLOP per token (MoE, no serving ideas yet)', `${flopPerToken(s, v0).toExponential(2)}`);
}

// ---------- effective labour = humans when coverage is 0; humans + AI when coverage is 1 (L1 optimal split) ----------
{
  const P = mk().hidden.timeline.prod;
  const h = 12;
  const L0 = effLabour(P, 0, h, 1e6, 1);
  const L1 = effLabour(P, 1, h, 500, 1);
  const Lmid = effLabour(P, 0.5, h, 1e9, 1);
  const cap = h * Math.pow(0.5, (1 - P.rc) / P.rc);
  check(Math.abs(L0 - h) < 1e-9 && Math.abs(L1 - (h + 500)) < 1e-6 && Math.abs(Lmid / cap - 1) < 1e-3,
    'effective labour: humans when coverage is 0, humans plus AI when coverage is 1 (the optimal split), and unlimited AI is capped by the human share (1 − a)^((1−ρc)/ρc)', `L(a 0) ${L0}, L(a 1) ${L1.toFixed(1)}, L(a 0.5, AI → ∞) ${Lmid.toFixed(2)} vs ${cap.toFixed(2)}`);
}

// ---------- a line with constant inputs reproduces r ----------
{
  const s = mk();
  const n = TREE_BY_ID['L.data'];
  const pool = linePool(s, n);
  // The pool's telescoping sum: each doubling of the cumulative research input adds r_l·log₁₀2, whatever the history.
  let R = 0;
  let e = 0;
  const marks: number[] = [];
  let next = pool.n0;
  while (marks.length < 4) {
    e += poolMean(pool, R, 1, 1);
    R += 1;
    if (pool.n0 + R >= 2 * next) { marks.push(e); next *= 2; }
  }
  const steps = marks.slice(1).map((x, i) => x - marks[i]);
  const want = pool.r * Math.log10(2);
  check(steps.every((d) => Math.abs(d / want - 1) < 0.01), 'returns: a line\'s stack is r_l·log₁₀ of its cumulative research input (each doubling adds r_l·log₁₀2)', `doublings add ${steps.map((d) => d.toFixed(4)).join(', ')} OOM; r_l·log₁₀2 = ${want.toFixed(4)}`);
  // In the engine: one line at fixed inputs (no hiring, fixed compute). Its pool advances by each result's true effect,
  // so its realised stack is r_l·log₁₀(R/n₀) exactly; against its cumulative research input Q (Σ batch × taste) it adds a
  // constant amount per doubling of Q once Q is well past the pool's start (AIFM: SE = r·log₁₀ RS).
  const g = mk(5);
  g.player.hiring.targets = { eng: 0, 're.cap': 0, 'sci.cap': 0, 're.saf': 0, 'sci.saf': 0 };
  // V4.0: a new game starts with the default lines on the priority list; this experiment runs one line alone.
  g.player.research.queue = g.player.research.queue.filter((id) => !id.startsWith('L.'));
  engine.act(g, 'research.queue', { id: 'L.data' });
  engine.act(g, 'research.want', { id: 'L.data', n: 6 });
  const realised: { Q: number; e: number }[] = [];
  for (let d = 0; d < 365 * 8; d++) {
    g.player.computeOnline = 1e6;
    tick(g, { skip: ['endings'] });
    const st = g.player.tree['L.data']?.cap;
    if (d % 10 === 0 && st) realised.push({ Q: st.input ?? 0, e: pool.r * Math.log10((pool.n0 + (st.pool ?? 0)) / pool.n0) });
  }
  const Qend = realised[realised.length - 1]?.Q ?? 0;
  const at = (x: number) => realised.find((r) => r.Q >= x);
  const a1 = at(Qend / 4);
  const a2 = at(Qend / 2);
  const a3 = realised[realised.length - 1];
  const ok = !!a1 && !!a2 && !!a3 && Qend > 0;
  // With constant inputs the pool state grows linearly in research input, R = n₀ + f·Q (f: how much better the picked
  // candidates are than the prior), so the realised stack is r_l·log₁₀(1 + f·Q/n₀): its slope per decade of Q tends to r_l.
  const fOf = (x: { Q: number; e: number }) => (pool.n0 * (Math.pow(10, x.e / pool.r) - 1)) / x.Q;
  const fs3 = ok ? [fOf(a1!), fOf(a2!), fOf(a3!)] : [];
  const slope = ok ? (a3!.e - a2!.e) / Math.log10(a3!.Q / a2!.Q) : NaN;
  // f drifts up slowly (the candidate pool fills, so the picked candidates get better), so the check is the r law itself:
  // the last doubling of Q adds at least 70% of r_l·log₁₀2 and more than the doubling before (it tends to r_l).
  check(ok && slope > 0.7 * pool.r && slope < 1.02 * pool.r && slope > (a2!.e - a1!.e) / Math.log10(a2!.Q / a1!.Q),
    'returns: in the engine a line at fixed inputs reproduces r (its last doubling of research input adds r_l·log₁₀2)',
    ok ? `selection factor f ${fs3.map((x) => x.toFixed(2)).join(' / ')} at Q/4, Q/2, Q; last doubling ${slope.toFixed(3)} OOM per decade (r_l ${pool.r.toFixed(3)}); input ${Qend.toFixed(0)}, n₀ ${pool.n0.toFixed(0)}` : 'no results');
}

// ---------- doubling FLOP speeds a compute-bound experiment, not a labour-bound one (and vice versa) ----------
{
  const P = mk().hidden.timeline.prod;
  // AIFM's experiment CES is close to Cobb-Douglas (σ ≈ 0.89), so the bound input shows only far from balance.
  const comp = { c: 1e-6, l: 1e6 }; // compute-bound: little FLOP, much labour
  const lab = { c: 1e6, l: 1e-6 }; // labour-bound
  const r = (x: { c: number; l: number }, dc: number, dl: number) => Xces(P, x.c * dc, x.l * dl) / Xces(P, x.c, x.l);
  check(r(comp, 2, 1) > 1.4 && r(lab, 2, 1) < 1.05, 'experiments: doubling project FLOP speeds a compute-bound experiment and not a labour-bound one', `×${r(comp, 2, 1).toFixed(2)} vs ×${r(lab, 2, 1).toFixed(3)}`);
  check(r(lab, 1, 2) > 1.4 && r(comp, 1, 2) < 1.05, 'experiments: doubling labour speeds a labour-bound experiment and not a compute-bound one', `×${r(lab, 1, 2).toFixed(2)} vs ×${r(comp, 1, 2).toFixed(3)}`);
}

// ---------- milestones fire in order SC → SAR → SIAR → ASI ----------
{
  const s = mk();
  const w = s.hidden.timeline;
  // A synthetic version: the reference recipe at a G (no specialisation), swept upward.
  const v0 = s.player.models.versions[0];
  const at = (dG: number): ModelVersion => ({ ...v0, build: { ...(v0.build as NonNullable<ModelVersion['build']>), dg: (v0.build?.dg ?? 0) + dG, h80Mult: 1 } });
  let first: (number | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  let ordered = true;
  for (let dG = 0; dG < 20; dG += 0.02) {
    const m = versionMilestones(s, at(dG));
    for (let i = 3; i < 7; i++) {
      if (m[i] && first[i] === undefined) first[i] = dG;
      if (m[i] && !m[i - 1]) ordered = false;
    }
  }
  const sc = first[3] ?? NaN;
  const wantSIAR = refPoints(w, 'IDEAS').best + 2 * w.v3.dBM;
  check(ordered && first.slice(3).every((x, i, a) => x !== undefined && (i === 0 || x >= (a[i - 1] as number))), 'milestones: SC → SAR → SIAR → ASI in order as effective compute grows', `ΔG at SC ${sc.toFixed(2)}, SAR ${first[4]?.toFixed(2)}, SIAR ${first[5]?.toFixed(2)}, ASI ${first[6]?.toFixed(2)} OOM over V0`);
  // Definitions: SC at the best human's SWE fit (G_SC), taste 0.5 SD there, SIAR at 3 × 3.09 SD.
  const vSC = at(sc);
  const sdSC = sdAIOf(w, fitOf(s, vSC, 'IDEAS'));
  check(Math.abs(fitOf(s, vSC, 'SWE') - w.v3.gSC) < 0.3 && Math.abs(sdSC - w.v3.sdSC) < 1.2 && Math.abs(sdAIOf(w, wantSIAR) - 3 * TOP_SD) < 1e-9 && REF_DELTA.CODE === 0,
    'milestones: the superhuman coder sits at G_SC with AI taste ≈ 0.5 SD; the superintelligent researcher at 9.27 SD', `SWE fit at SC − G_SC ${(fitOf(s, vSC, 'SWE') - w.v3.gSC).toFixed(2)} OOM, taste at SC ${sdSC.toFixed(2)} SD, SIAR ${sdAIOf(w, wantSIAR).toFixed(2)} SD`);
  // In a game: the reference bot records them in order.
  const g = refGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027 }));
  runRef(g, 365 * 5, (x) => x.player.milestoneDays[6] !== undefined);
  const md = g.player.milestoneDays;
  const days = [3, 4, 5, 6].map((i) => md[i as 3]);
  check(days.every((d, i) => d !== undefined && (i === 0 || d >= (days[i - 1] as number))), 'milestones: the reference bot reaches SC → SAR → SIAR → ASI in order', days.join(' → '));
}

// ---------- a fixed lab's research speed does not change with the calendar ----------
{
  const s = mk(9);
  for (let d = 0; d < 20; d++) tick(s, { skip: ['endings'] });
  const before = { x: researchInputs(s, 9).X, M: workContext(s).slots.EXP.m, cov: workContext(s).slots.EXP.fit.a };
  const later = structuredClone(s) as GameStateV2;
  later.time.day += 3 * 365; // the same lab, three years later on the calendar
  const after = { x: researchInputs(later, 9).X, M: workContext(later).slots.EXP.m, cov: workContext(later).slots.EXP.fit.a };
  check(Math.abs(after.x / before.x - 1) < 1e-9 && Math.abs(after.M / before.M - 1) < 0.02 && Math.abs(after.cov - before.cov) < 1e-9,
    'calendar: a fixed lab\'s research speed, AI multiplier and coverage are the same three years later', `X ${before.x.toFixed(4)} → ${after.x.toFixed(4)}, M ${before.M.toFixed(3)} → ${after.M.toFixed(3)}, EXP coverage ${before.cov.toFixed(3)} → ${after.cov.toFixed(3)}`);
  const v = bestPlayerVersion(s) as ModelVersion;
  const t1 = teamTaste(0, sdAIOf(s.hidden.timeline, fitOf(s, v, 'IDEAS')), 1, s.hidden.timeline.prod.m2b, 1, s.hidden.timeline.v3.tasteLimit);
  check(Math.abs(t1 - 1) < 0.01 && teamTaste(1, -6, 0, 3.25, 1, 8) > 1.4 && teamTaste(0, 9.27, 1, 3.25, 1, 1e9) > 25, 'taste: a Strong team without AI = 1; Elite ≈ ×1.46; AI at SIAR (9.27 SD) lifts a team to ≈ ×30', `start ${t1.toFixed(3)}, Elite ${teamTaste(1, -6, 0, 3.25, 1, 8).toFixed(2)}, SIAR ${teamTaste(0, 9.27, 1, 3.25, 1, 1e9).toFixed(1)}`);
}

// ---------- engineering at the start (V3b): every start type carries its upkeep and a base run setup in its first quarter ----------
{
  const rows: string[] = [];
  let ok = true;
  for (const start of ['leader', 'challenger', 'bigtech', 'spinout'] as const) {
    const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 3, tutorial: false, start }));
    for (let d = 0; d < 7; d++) tick(s, { skip: ['endings'] });
    const cap = buildCapacity(s).capacity;
    const up = upkeepSplit(s).total;
    // A base sized to train in about six months on the start's training pool.
    const flop = s.player.computeOnline * s.player.split.training * 3.46e19 * 182 * 0.9;
    const setup = runSetupTW('base', engScale(flop));
    const spare = (cap - up) * 13;
    if (spare < setup) ok = false;
    rows.push(`${start} ${cap.toFixed(1)} − ${up.toFixed(1)} tw/wk → ${spare.toFixed(1)} vs setup ${setup.toFixed(2)}`);
  }
  check(ok, 'engineering: every start type carries its upkeep plus a base run setup in its first quarter', rows.join('; '));
}

// ---------- lint: no player mechanism reads the reference path or the knot tables ----------
{
  const root = join(HERE, '..', '..', 'src', 'engine', 'v2');
  const files: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
  walk(root);
  const FORBIDDEN = /\b(frontierFlop|hRef|refTotal|shareRefAt|knotAt|multiplierAt|multiplierRef|laborSlowdown|referenceTech)\b/;
  // Allowed: the definitions (production/ces.ts, world/), rivals / China / the leader lab
  // (actors/), the reference bot (bots/: the calibration harness's policy), the compute-split module that defines the
  // reference split and offers it as a player preset (departments/split.ts) and the selector re-exports; any other line
  // must name the RD plan item that removes it ("until RD-U06", design/RD-AUDIT/SYNTHESIS.md §6; RD-C06 replaced the
  // old V6 / V7 bridge tags).
  const ALLOWED = ['production/ces.ts', 'world/', 'actors/', 'bots/', 'departments/split.ts', 'core/selectors.ts'];
  const bad: string[] = [];
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/');
    if (ALLOWED.some((a) => rel.startsWith(a))) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*\*?.*?(\*\/|$)/, '').replace(/^\s*\*.*$/, '');
      if (/^\s*import\b/.test(line) || !FORBIDDEN.test(code)) return;
      if (/\bRD-[A-Z]\d+[a-z]?\b/.test(line)) return;
      bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  check(bad.length === 0, 'lint: no player mechanism reads frontierFlop, hRef, refTotal, shareRefAt, knotAt or multiplierAt (allowed: harness, rivals, lines naming the RD item that removes them)', bad.slice(0, 6).join(' | '));
  const wf = readFileSync(join(root, 'departments', 'workfit.ts'), 'utf8');
  check(!/\.pm\b(?!\))/.test(wf.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) && !/levelOf|thresholds\(/.test(wf),
    'lint: the work-type layer (fit, coverage, milestones) reads effective compute, not pm or the level bridge', '');
  void WORK_TYPES;
}


// ---------- RD-B18: people previews are one day of the mechanism on a copy (B32 hires, B33 agents, B34 star taste) ----------
{
  const fx = (d: number) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
  const cl = (x: GameStateV2) => deserialize(serialize(x));
  const pv = (s: GameStateV2, id: string, p: Record<string, string | number | boolean> = {}) => ACTION_BY_ID.get(id)!.preview(s, p);
  const readNow = (c: GameStateV2): DayRead => readState(c);
  const near = (a: number, b: number, rel: number, abs: number) => Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));
  for (const d of [400, 900]) {
    const s = fx(d);
    const t0 = cl(s);
    tick(t0, { skip: ['endings'] });
    const base = readNow(t0);
    const rows: string[] = [];
    let ok = true;
    for (const key of ['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'] as const) {
      const g = pv(s, 'teams.hire', { key }).gains[0];
      // The hire's team, full and arrived, on a copy: one full engine day.
      const role = key === 'eng' ? 'eng' : (key.split('.')[0] as 're' | 'sci');
      const dept = key.endsWith('saf') ? 'saf' : 'cap';
      const c = cl(s);
      const spec = role === 'sci' ? { specialty: nextSpecialty([...s.player.teams, ...s.player.hiring.filling], dept) } : {};
      c.player.teams.push({ id: 'T-test', role, dept, size: TEAM_SIZE[role], heads: TEAM_SIZE[role], ...spec });
      tick(c, { skip: ['endings'] });
      const want = effectLine(s, base, readNow(c), { role, dept });
      const same = g.unit === want.unit && (g.unit === 'days' ? near(g.amount, want.amount, 0.1, 1) : near(g.amount, want.amount, 0.05, 0.02));
      ok &&= same && !(key === 'sci.cap' && g.unit === '%') && !(dept === 'saf' && /staff/.test(String(g.target)));
      rows.push(`${key} ${g.amount} ${g.unit} vs ${want.amount} ${want.unit}${same ? '' : ' ✗'}`);
    }
    check(ok, `RD-B18 @day ${d}: each hire preview = one engine day on a copy with the team (build, project days, safety results)`, rows.join('; '));
    // Agents: no constant security line; a routine-compute change that re-normalises engineering shows its build delta,
    // equal to build capacity on the applied copy.
    const x = Math.min(0.9, capShare(s, 'capRoutine') + 0.2);
    const a = pv(s, 'agents.set', { use: 'capRoutine', compute: x });
    const ca = cl(s);
    engine.act(ca, 'agents.set', { use: 'capRoutine', compute: x });
    const dB = Math.round((buildCapacity(ca).capacity - buildCapacity(s).capacity) * 1000) / 1000;
    const line = [...a.costs, ...a.gains].find((l) => l.target === 'build capacity');
    check(![...a.costs, ...a.gains].some((l) => l.currency === 'security') && (dB === 0 ? !line : !!line && Math.abs(line.amount - dB) < 2e-3),
      `RD-B18 @day ${d}: agent preview has no constant security line and shows the build change of the applied copy`, `build ${line?.amount ?? 'none'} vs ${dB}; lines ${[...a.costs, ...a.gains].map((l) => `${l.currency} ${l.amount}`).join(', ')}`);
  }
  // CP4: the Company panel is gone (UB-5): the Star hire chip lives on LAB (Lab.tsx / LabTabs.tsx).
  const company = ['Lab.tsx', 'LabTabs.tsx'].map((f) => readFileSync(join(HERE, '../../src/ui/v2/panels', f), 'utf8')).join('\n');
  const wt = readFileSync(join(HERE, '../../src/data/v2/workTypes.ts'), 'utf8');
  check(!/quality and stars/.test(company) && !/STAR_TASTE/.test(wt), 'RD-B18 the taste chip no longer claims quality enters it', '');
}

finish('worktypes');
