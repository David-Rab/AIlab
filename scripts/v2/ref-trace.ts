// RefBot reference trace (BUILD-PLAN R1): the calibration baseline every restructure milestone (R3–R8) diffs against.
//
//   npx tsx scripts/v2/ref-trace.ts --write [--out path]   record scripts/v2/golden/ref-trace.json
//   npx tsx scripts/v2/ref-trace.ts [--ref path] [--tol key=value,…] [--only stub:ai2027,…]
//                                                          diff the current code against the recorded trace
//
// Traces: RefBot's model policy on the four T1 presets with the reference-compute stub (as calib.ts T1: infinite cash,
// endings skipped, stop at the last golden milestone), and the full RefBot (real finance, revenue and events) on
// ai2027 (as calib.ts "T1 integrated": endings skipped, stop at ASI, insolvency or 16 years). Each trace records run
// start/finish days, paradigm adoption days, milestone days, monthly M, h, k, c, sdAI (and pa, L), quarterly revenue
// per channel, cash and U. The diff prints the worst deviation per category and exits 1 if any exceeds its tolerance.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { refBot } from '../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { quarterIndex } from '../../src/engine/v2/core/time';
import { engine } from '../../src/engine/v2/index';
import { production } from '../../src/engine/v2/production/readout';
import { understanding } from '../../src/engine/v2/safety/understanding';
import { stacksGEquiv } from '../../src/engine/v2/models/stacks';
import type { GameStateV2, MilestoneIdx, WorldPresetId } from '../../src/engine/v2/types';
import { refGame, runRef } from './lib';

const HERE = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DEFAULT_PATH = join(HERE, 'golden', 'ref-trace.json');
const SEED = 2027;
const MAX_DAYS = 365 * 16;
const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'] as const;
const STUB_PRESETS: WorldPresetId[] = ['ai2027', 'authors2026', 'fast', 'slow'];
const lastIdx = (p: WorldPresetId): MilestoneIdx => (p === 'slow' ? 3 : 6);

const arg = (k: string, d = '') => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const r4 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : 0);

export interface RunRec { id: string; kind: string; start: number; end?: number; status: string }
export interface MonthRec { day: number; M: number; h: number; k: number; c: number; sdAI: number; recipe: number; L: number }
export interface QuarterRec { day: number; revenue: Record<string, number>; cash: number; U: number }
export interface Trace {
  id: string; preset: string; mode: 'stub' | 'integrated'; seed: number; endDay: number; status: string;
  milestones: Partial<Record<(typeof NAMES)[number], number>>;
  paradigms: Record<string, number>;
  runs: RunRec[];
  monthly: MonthRec[];
  quarterly: QuarterRec[];
}
export interface TraceFile { note: string; commit?: string; recorded: string; traces: Trace[] }

/** Observer: called before the first tick and after every tick. */
function recorder(id: string, preset: string, mode: Trace['mode'], s: GameStateV2) {
  const t: Trace = { id, preset, mode, seed: s.setup.seed, endDay: 0, status: '', milestones: {}, paradigms: {}, runs: [], monthly: [], quarterly: [] };
  const runs = new Map<string, RunRec>();
  let lastQ = -1;
  const observe = () => {
    const p = s.player;
    const day = s.time.day;
    for (const r of p.models.runs) {
      let rec = runs.get(r.id);
      if (!rec) {
        rec = { id: r.id, kind: r.kind, start: r.startDay, status: r.status };
        runs.set(r.id, rec);
        t.runs.push(rec);
      }
      if (rec.end === undefined && (r.status === 'done' || r.status === 'failed' || r.status === 'cancelled')) rec.end = day;
      rec.status = r.status;
    }
    for (const [pid, st] of Object.entries(p.paradigms)) if (st.status === 'adopted' && t.paradigms[pid] === undefined) t.paradigms[pid] = day;
    if (day % 30 === 0) {
      const pr = production(s, 'player');
      const L = Math.max(0, ...p.models.versions.map((v) => v.Lg));
      t.monthly.push({ day, M: r4(s.player.research.last?.x?.mExp ?? 1), h: r4(pr.ratios.h), k: r4(pr.ratios.k), c: r4(pr.ratios.c), sdAI: r4(pr.sdAI), recipe: r4(stacksGEquiv(s)), L: r4(L) });
    }
    const q = quarterIndex(s.time.startDate, day);
    if (q !== lastQ) {
      lastQ = q;
      const revenue: Record<string, number> = {};
      for (const d of p.deployments) if (d.status !== 'withdrawn' && d.revenueRate) revenue[d.channel] = r4((revenue[d.channel] ?? 0) + d.revenueRate);
      t.quarterly.push({ day, revenue, cash: r4(p.finance.cash), U: r4(understanding(s).U) });
    }
  };
  const done = () => {
    t.endDay = s.time.day;
    t.status = s.player.status;
    NAMES.forEach((n, i) => {
      const d = s.player.milestoneDays[i as MilestoneIdx];
      if (d !== undefined) t.milestones[n] = d;
    });
    return t;
  };
  return { observe, done };
}

function stubTrace(preset: WorldPresetId): Trace {
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED }));
  const rec = recorder(`stub:${preset}`, preset, 'stub', s);
  rec.observe();
  const stop = lastIdx(preset);
  // runRef one day at a time so the observer sees every day (same play and tick order as calib.ts T1).
  while (s.time.day < MAX_DAYS && !s.ending && s.player.milestoneDays[stop] === undefined) {
    runRef(s, s.time.day + 1);
    rec.observe();
  }
  return rec.done();
}

function integratedTrace(preset: WorldPresetId): Trace {
  const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED, tutorial: false }));
  const rec = recorder(`integrated:${preset}`, preset, 'integrated', s);
  rec.observe();
  const stop = lastIdx(preset);
  while (s.time.day < MAX_DAYS && s.player.milestoneDays[stop] === undefined && s.player.status === 'active') {
    for (const p of [...s.events.pending]) {
      const c = refBot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    refBot.act(s, engine);
    tick(s, { skip: ['endings'] });
    rec.observe();
  }
  return rec.done();
}

function record(only?: Set<string>): Trace[] {
  const out: Trace[] = [];
  const want = (id: string) => !only || only.has(id);
  for (const p of STUB_PRESETS) if (want(`stub:${p}`)) {
    const t0 = performance.now();
    out.push(stubTrace(p));
    process.stderr.write(`  stub:${p} ${out[out.length - 1].endDay} d (${((performance.now() - t0) / 1000).toFixed(1)} s)\n`);
  }
  if (want('integrated:ai2027')) {
    const t0 = performance.now();
    out.push(integratedTrace('ai2027'));
    process.stderr.write(`  integrated:ai2027 ${out[out.length - 1].endDay} d (${((performance.now() - t0) / 1000).toFixed(1)} s)\n`);
  }
  return out;
}

// ───────────────────────────── diff ─────────────────────────────

/** Tolerances: days are absolute, `rel*` relative (fraction), `abs*` absolute. Override with --tol key=value,…
 *  R3: the player's h now moves in whole research-engineering teams (one team ≈ 9% of h at the start), so the monthly
 *  h tolerance is one team; the calibration gate on labour is the mean h over the common months (relMeanH). */
export const TOL: Record<string, number> = {
  milestoneDays: 10, paradigmDays: 14, runDays: 7,
  relM: 0.05, relH: 0.1, relMeanH: 0.01, relK: 0.05, relC: 0.05, absSdAI: 0.1, absRecipe: 0.12, absL: 0.15,
  relRevenue: 0.1, relCash: 0.1, absU: 0.25,
};

interface Row { trace: string; what: string; worst: number; tol: number; where: string; unit: string }

/** Worst relative difference |a−b|/max(|b|, floor). */
const rel = (a: number, b: number, floor: number) => Math.abs(a - b) / Math.max(Math.abs(b), floor);

function diffTrace(cur: Trace, ref: Trace): Row[] {
  const rows: Row[] = [];
  const add = (what: string, tol: number, unit: string, items: [number, string][]) => {
    let worst = 0;
    let where = '—';
    for (const [d, w] of items) if (d > worst || (!Number.isFinite(d) && Number.isFinite(worst))) { worst = d; where = w; }
    rows.push({ trace: cur.id, what, worst, tol, where, unit });
  };
  // Milestones present in either trace.
  add('milestone days', TOL.milestoneDays, 'd', NAMES.filter((n) => cur.milestones[n] !== undefined || ref.milestones[n] !== undefined).map((n) => {
    const a = cur.milestones[n];
    const b = ref.milestones[n];
    return [a === undefined || b === undefined ? Infinity : Math.abs(a - b), `${n} ${a ?? '—'} vs ${b ?? '—'}`];
  }));
  add('paradigm adoption days', TOL.paradigmDays, 'd', [...new Set([...Object.keys(cur.paradigms), ...Object.keys(ref.paradigms)])].map((id) => {
    const a = cur.paradigms[id];
    const b = ref.paradigms[id];
    return [a === undefined || b === undefined ? Infinity : Math.abs(a - b), `${id} ${a ?? '—'} vs ${b ?? '—'}`];
  }));
  // Runs matched by kind and ordinal (ids can shift when an extra run is launched).
  const byKind = (t: Trace) => {
    const m = new Map<string, RunRec[]>();
    for (const r of t.runs) m.set(r.kind, [...(m.get(r.kind) ?? []), r]);
    return m;
  };
  const ck = byKind(cur);
  const rk = byKind(ref);
  const runItems: [number, string][] = [];
  for (const kind of new Set([...ck.keys(), ...rk.keys()])) {
    const a = ck.get(kind) ?? [];
    const b = rk.get(kind) ?? [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i];
      const y = b[i];
      if (!x || !y) {
        runItems.push([Infinity, `${kind} #${i + 1} only in ${x ? 'current' : 'reference'}`]);
        continue;
      }
      runItems.push([Math.abs(x.start - y.start), `${kind} #${i + 1} start ${x.start} vs ${y.start}`]);
      if (x.end !== undefined || y.end !== undefined) runItems.push([x.end === undefined || y.end === undefined ? Infinity : Math.abs(x.end - y.end), `${kind} #${i + 1} end ${x.end ?? '—'} vs ${y.end ?? '—'}`]);
    }
  }
  add('run start/finish days', TOL.runDays, 'd', runItems);
  // Monthly series on common days.
  const rm = new Map(ref.monthly.map((m) => [m.day, m]));
  const months = cur.monthly.filter((m) => rm.has(m.day));
  const series = (key: keyof MonthRec, what: string, tol: number, relative: boolean, floor = 0.05) =>
    add(what, tol, relative ? '%' : '', months.map((m) => {
      const b = rm.get(m.day)![key];
      return [relative ? rel(m[key], b, floor) : Math.abs(m[key] - b), `day ${m.day}: ${m[key]} vs ${b}`];
    }));
  series('M', 'monthly M', TOL.relM, true, 0.5);
  series('h', 'monthly h', TOL.relH, true);
  const meanOf = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
  const mhA = meanOf(months.map((m) => m.h));
  const mhB = meanOf(months.map((m) => rm.get(m.day)!.h));
  add('mean h', TOL.relMeanH, '%', [[rel(mhA, mhB, 0.05), `${mhA.toFixed(4)} vs ${mhB.toFixed(4)} over ${months.length} months`]]);
  series('k', 'monthly k', TOL.relK, true);
  series('c', 'monthly c', TOL.relC, true);
  series('sdAI', 'monthly sdAI', TOL.absSdAI, false);
  series('recipe', 'monthly recipe (OOM G-equivalent; model v3 F3: was pa)', TOL.absRecipe, false);
  series('L', 'monthly best L', TOL.absL, false);
  // Quarterly (integrated traces carry real revenue and cash; the stub has infinite cash).
  const rq = new Map(ref.quarterly.map((q) => [q.day, q]));
  const quarters = cur.quarterly.filter((q) => rq.has(q.day));
  if (cur.mode === 'integrated') {
    add('quarterly revenue per channel', TOL.relRevenue, '%', quarters.flatMap((q) => {
      const b = rq.get(q.day)!;
      return [...new Set([...Object.keys(q.revenue), ...Object.keys(b.revenue)])].map((ch) => [rel(q.revenue[ch] ?? 0, b.revenue[ch] ?? 0, 1), `day ${q.day} ${ch}: ${q.revenue[ch] ?? 0} vs ${b.revenue[ch] ?? 0}`] as [number, string]);
    }));
    add('quarterly cash', TOL.relCash, '%', quarters.map((q) => [rel(q.cash, rq.get(q.day)!.cash, 1), `day ${q.day}: ${q.cash} vs ${rq.get(q.day)!.cash}`]));
  }
  add('quarterly U', TOL.absU, '', quarters.map((q) => [Math.abs(q.U - rq.get(q.day)!.U), `day ${q.day}: ${q.U} vs ${rq.get(q.day)!.U}`]));
  if (cur.endDay !== ref.endDay || cur.status !== ref.status) rows.push({ trace: cur.id, what: 'end', worst: cur.status !== ref.status ? Infinity : Math.abs(cur.endDay - ref.endDay), tol: TOL.milestoneDays, where: `${cur.status} day ${cur.endDay} vs ${ref.status} day ${ref.endDay}`, unit: 'd' });
  return rows;
}

function main() {
  const path = arg('out') || arg('ref') || DEFAULT_PATH;
  const onlyArg = arg('only');
  const only = onlyArg ? new Set(onlyArg.split(',')) : undefined;
  for (const kv of arg('tol').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    if (!(k in TOL) || !Number.isFinite(Number(v))) throw new Error(`unknown tolerance ${kv} (keys: ${Object.keys(TOL).join(', ')})`);
    TOL[k] = Number(v);
  }
  const t0 = performance.now();
  if (process.argv.includes('--write')) {
    const traces = record(only);
    const file: TraceFile = {
      note: 'RefBot reference trace (BUILD-PLAN R1). Stub traces: refPlay + reference-compute stub, seed 2027, alignment medium. Integrated: full RefBot, real finance. Regenerate only on purpose: npx tsx scripts/v2/ref-trace.ts --write',
      ...(arg('commit') ? { commit: arg('commit') } : {}),
      recorded: new Date().toISOString().slice(0, 10),
      traces,
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(file, null, 0).replace(/\{"id":/g, '\n{"id":'));
    console.log(`ref-trace: wrote ${traces.length} traces to ${path} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
    return;
  }
  const ref = JSON.parse(readFileSync(path, 'utf8')) as TraceFile;
  const cur = record(only);
  const rows: Row[] = [];
  for (const t of cur) {
    const r = ref.traces.find((x) => x.id === t.id);
    if (!r) rows.push({ trace: t.id, what: 'missing in reference', worst: Infinity, tol: 0, where: '', unit: '' });
    else rows.push(...diffTrace(t, r));
  }
  const fmt = (x: number, unit: string) => (!Number.isFinite(x) ? 'n/a' : unit === '%' ? `${(x * 100).toFixed(1)}%` : unit === 'd' ? `${x.toFixed(0)} d` : x.toFixed(3));
  let bad = 0;
  console.log(`\nref-trace diff vs ${path}${ref.commit ? ` (recorded at ${ref.commit})` : ''}\n`);
  for (const r of rows) {
    const ok = r.worst <= r.tol + 1e-9;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.trace.padEnd(20)} ${r.what.padEnd(30)} worst ${fmt(r.worst, r.unit).padStart(8)}  tol ${fmt(r.tol, r.unit).padStart(6)}  ${r.where}`);
  }
  console.log(`\nref-trace: ${bad ? `${bad} over tolerance` : 'all within tolerance'} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(bad ? 1 : 0);
}

main();
