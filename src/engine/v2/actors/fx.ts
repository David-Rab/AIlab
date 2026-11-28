// Shared WS4 effect and preview helpers: meters, cost lines (V2-SPEC §2.6, §2.7). Owner: WS4.
// Every meter change goes through ctx.bump / ctx.cause so the "why" strip can explain it.
import type { CostLine, Currency, GameStateV2, SystemCtx } from '../types';
import { bookCash } from '../finance/ledger';

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

/** One-off costs/income (actions, events, fines) go through WS3's finance ledger (kind 'relations'). */
export const cash = (s: GameStateV2, ctx: SystemCtx, d: number, src: string, detail?: string) => bookCash(s, ctx, d, 'relations', src, detail);
export const morale = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale', d, src, detail);
export const moraleSafety = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale.safety', d, src, detail);

