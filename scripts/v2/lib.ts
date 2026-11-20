// Shared helpers for v2 headless scripts (V2-SPEC §7). Owner: WS1.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tick } from '../../src/engine/v2/core/loop';
import { newGame } from '../../src/engine/v2/core/init';
import { decimalYear } from '../../src/engine/v2/core/time';
import { refPlay } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2/index';
import { refTotal } from '../../src/engine/v2/production/knots';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import type { EngineSystem, GameStateV2, SetupV2, TickOptions } from '../../src/engine/v2/types';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixtures');
export const GOLDEN_PATH = join(HERE, 'golden', 'timelines.json');

export function runTo(s: GameStateV2, day: number, opts?: TickOptions) {
  while (s.time.day < day && !s.ending) tick(s, opts);
  return s;
}

/** Plain-JSON check: no undefined, NaN, ±Infinity, functions, class instances (V2 types.ts rules). */
export function validateJson(x: unknown, path = 's', errs: string[] = []): string[] {
  if (errs.length > 20) return errs;
  if (x === undefined) errs.push(`${path} is undefined`);
  else if (typeof x === 'number') {
    if (!Number.isFinite(x)) errs.push(`${path} = ${x}`);
  } else if (typeof x === 'function') errs.push(`${path} is a function`);
  else if (Array.isArray(x)) x.forEach((v, i) => validateJson(v, `${path}[${i}]`, errs));
  else if (x && typeof x === 'object') {
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== null) errs.push(`${path} is a ${proto?.constructor?.name ?? 'non-plain object'}`);
    for (const [k, v] of Object.entries(x)) validateJson(v, `${path}.${k}`, errs);
  }
  return errs;
}

/**
 * Stub compute (stands in for WS3 until merged): every lab's online compute tracks refTotal(t) at its start ratio
 * (the player at exactly 1×, i.e. h,k,c ≈ 1). Runs right after computeOnline (order 20).
 */
export const refComputeStub: EngineSystem = {
  id: 'stubRefCompute', owner: 'WS1', cadence: 'daily', order: 21, system: 'core',
  run(s) {
    const w = s.hidden.timeline;
    const yr = decimalYear(s);
    const ref = refTotal(w, yr);
    s.player.computeOnline = ref;
    for (const r of [...s.rivals, s.china.lab]) {
      if (r.core.id === LEADER_ID) continue; // the leader lab sets its own reference compute (R2)
      const key = `stub:ratio:${r.core.id}`;
      if (s.flags[key] === undefined) s.flags[key] = r.core.computeOnline / refTotal(w, 2025.5);
      r.core.computeOnline = ref * Number(s.flags[key]);
    }
  },
};

/** Stub finance for fixtures (until WS3/WS5 cash flows land): cash never falls below the start balance. */
export const cashFloorStub: EngineSystem = {
  id: 'stubCashFloor', owner: 'WS1', cadence: 'daily', order: 131, system: 'core',
  run(s, ctx) {
    const floor = Number(s.flags['stub:cash0'] ?? (s.flags['stub:cash0'] = s.player.finance.cash));
    if (s.player.finance.cash < floor) ctx.bump('cash', floor - s.player.finance.cash, 'stub finance');
  },
};

/** New game prepared for RefBot calibration runs: stub finance (cash effectively infinite). */
export function refGame(setup: SetupV2): GameStateV2 {
  const s = newGame(setup);
  s.player.finance.cash = 1e6;
  return s;
}

/** Run RefBot's model policy (refPlay) with the reference-compute stub until `day` or until `stop(s)` is true. The
 *  endings system is skipped: T1 measures the capability timeline, not how the game would end. */
export function runRef(s: GameStateV2, day: number, stop?: (s: GameStateV2) => boolean, opts: TickOptions = {}) {
  const o: TickOptions = { ...opts, extraSystems: [refComputeStub, ...(opts.extraSystems ?? [])], skip: ['endings', ...(opts.skip ?? [])] };
  while (s.time.day < day && !s.ending && !stop?.(s)) {
    refPlay(s, engine);
    tick(s, o);
  }
  return s;
}

let failures = 0;
let smokeSkipped = 0;
/** `--smoke` (test:quick): long multi-seed suites run 1–2 seeds or short horizons. Checks whose inputs are reduced go
 *  through smokeCheck and cannot fail; checks that still run at full strength stay binding. */
export const SMOKE = process.argv.includes('--smoke');
/** A calibration / statistical target. Exactly check() in a full run; under --smoke it prints a SMOKE line (never a
 *  failure), because its seeds or horizon were cut. */
export function smokeCheck(ok: boolean, label: string, detail = '', note?: string) {
  if (!SMOKE) return check(ok, label, detail);
  smokeSkipped++;
  console.log(`SMOKE ${note ?? (ok ? '(in band)' : '(out of band)')}  ${label}${detail ? '  — ' + detail : ''}`);
}
/** Documented deviations: a failing check whose label is listed here prints WARN instead of failing. */
export const KNOWN: Record<string, string> = {};
export function check(ok: boolean, label: string, detail = '') {
  const known = !ok && KNOWN[label];
  console.log(`${ok ? 'PASS' : known ? 'WARN' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}${known ? `\n      known deviation: ${known}` : ''}`);
  if (!ok && !known) failures++;
}
export function finish(name: string) {
  if (SMOKE) console.log(`\n${name}: SMOKE mode (reduced seeds/horizons): ${smokeSkipped} calibration target(s) informational; run without --smoke for the binding checks`);
  console.log(failures ? `\n${name}: ${failures} failure(s)` : `\n${name}: all passed`);
  process.exit(failures ? 1 : 0);
}
