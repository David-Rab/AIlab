// Shared WS4 effect and preview helpers: meters, cost lines (V2-SPEC §2.6, §2.7). Owner: WS4.
// Every meter change goes through ctx.bump / ctx.cause so the "why" strip can explain it.
import { clamp } from '../../rng';
import type { CostLine, Currency, GameStateV2, SystemCtx } from '../types';
import { bookCash } from '../finance/ledger';
import { ws4 } from './state';

// ───────────── previews ─────────────

export type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

/** Cost/gain line. Positive `amount` is magnitude; the column (costs/gains) gives the sign. */
export function L(currency: Currency, amount: number, target?: string, extra?: { lagDays?: number; probability?: number; unit?: string }): CostLine {
  const c: CostLine = { currency, amount: Math.round(amount * 100) / 100 };
  if (target !== undefined) c.target = target;
  if (extra?.lagDays !== undefined) c.lagDays = extra.lagDays;
  if (extra?.probability !== undefined) c.probability = Math.round(extra.probability * 100) / 100;
  if (extra?.unit !== undefined) c.unit = extra.unit;
  return c;
}

export function pv(costs: CostLine[], gains: CostLine[] = [], exposure: CostLine[] = []): Preview {
  return { costs, gains, exposure };
}

// ───────────── meters ─────────────

export const approval = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('pub.approval', d, src, detail);
export const concern = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('pub.concern', d, src, detail);
/** One-off costs/income (actions, events, fines) go through WS3's finance ledger (kind 'relations'). */
export const cash = (s: GameStateV2, ctx: SystemCtx, d: number, src: string, detail?: string) => bookCash(s, ctx, d, 'relations', src, detail);
export const morale = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale', d, src, detail);
export const moraleSafety = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale.safety', d, src, detail);
export const natPressure = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('gov.nationalization', d, src, detail);
export const theftIntent = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('china.theftIntent', d, src, detail);

/** Slow continuous drift applied directly; the accumulated Δ is flushed to the ledger weekly (keeps rings readable). */
export function drift(s: GameStateV2, obj: Record<string, number>, field: string, d: number, lo: number, hi: number, key: string) {
  const v0 = obj[field];
  const v = clamp(v0 + d, lo, hi);
  obj[field] = v;
  const w = ws4(s);
  w.drift[key] = (w.drift[key] ?? 0) + (v - v0);
}

export function flushDrift(s: GameStateV2, ctx: SystemCtx) {
  const w = ws4(s);
  for (const [k, v] of Object.entries(w.drift)) if (Math.abs(v) > 1e-6) ctx.cause(k, v, 'drift', 'weekly sum');
  w.drift = {};
}
