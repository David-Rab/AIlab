// Shared helpers for v2 headless scripts (V2-SPEC §7). Owner: WS1.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tick } from '../../src/engine/v2/core/loop';
import type { GameStateV2, TickOptions } from '../../src/engine/v2/types';

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

let failures = 0;
/** Documented deviations: a failing check whose label is listed here prints WARN instead of failing. */
export const KNOWN: Record<string, string> = {};
export function check(ok: boolean, label: string, detail = '') {
  const known = !ok && KNOWN[label];
  console.log(`${ok ? 'PASS' : known ? 'WARN' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}${known ? `\n      known deviation: ${known}` : ''}`);
  if (!ok && !known) failures++;
}
export function finish(name: string) {
  console.log(failures ? `\n${name}: ${failures} failure(s)` : `\n${name}: all passed`);
  process.exit(failures ? 1 : 0);
}
