// Per-tick memo of expensive derived values shared across systems (ctx.memo). Owner: WS1.
import type { SystemCtx } from '../types';

/** Get-or-compute a value for this tick. Keys: '<owner>:<name>[:<lab>]', e.g. 'WS2:understanding'. */
export function memo<T>(ctx: SystemCtx, key: string, compute: () => T): T {
  if (ctx.memo.has(key)) return ctx.memo.get(key) as T;
  const v = compute();
  ctx.memo.set(key, v);
  return v;
}
