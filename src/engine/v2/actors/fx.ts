// Shared WS4 effect and preview helpers: relation currencies, meters, cost lines (V2-SPEC §2.6, §2.7, §3.9.1).
// Owner: WS4. Every meter change goes through ctx.bump / ctx.cause so the "why" strip can explain it.
import { clamp } from '../../rng';
import type { BlocId, CostLine, CounterpartyId, Currency, GameStateV2, SystemCtx } from '../types';
import { bookCash } from '../finance/ledger';
import { trustDelta } from './relations';
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

// ───────────── relation currencies ─────────────

/** Trust change with the §3.9.1 asymmetry (gain base·(1 − T/100); loss base·3·(1 + T/100)). Returns applied Δ. */
export function trust(s: GameStateV2, ctx: SystemCtx, cp: CounterpartyId, base: number, source: string, detail?: string): number {
  const st = s.relations.stocks[cp];
  if (!st || !base) return 0;
  return ctx.bump(`trust:${cp}`, trustDelta(st.trust, base), source, detail);
}

/** Incident-type trust hit, scaled by the benefit of the doubt (1 − T/150) and dependence (1 − dep/200). */
export function trustHit(s: GameStateV2, ctx: SystemCtx, cp: CounterpartyId, base: number, source: string, detail?: string): number {
  const st = s.relations.stocks[cp];
  if (!st) return 0;
  const k = (1 - st.trust / 150) * (1 - st.depOnYou / 200);
  return ctx.bump(`trust:${cp}`, trustDelta(st.trust, -Math.abs(base) * k), source, detail);
}

export function trustMany(s: GameStateV2, ctx: SystemCtx, cps: readonly CounterpartyId[], base: number, source: string, detail?: string) {
  for (const cp of cps) trust(s, ctx, cp, base, source, detail);
}

/** Disclosure-type trust gain: multiplied by credibility; below 30 credibility it costs net trust (§3.9.1). */
export function disclosureTrust(s: GameStateV2, ctx: SystemCtx, cps: readonly CounterpartyId[], base: number, source: string) {
  const c = s.relations.credibility;
  const k = c < 30 ? -0.5 : c / 50;
  for (const cp of cps) trust(s, ctx, cp, base * k, source, `credibility ${Math.round(c)}`);
}

export const cred = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('relations.credibility', d, src, detail);
export const scrutiny = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('relations.scrutiny', d, src, detail);
export const talent = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('relations.talentPull', d, src, detail);
export const approval = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('pub.approval', d, src, detail);
export const concern = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('pub.concern', d, src, detail);
/** One-off relation costs/income (actions, events, fines) go through WS3's finance ledger (kind 'relations'). */
export const cash = (s: GameStateV2, ctx: SystemCtx, d: number, src: string, detail?: string) => bookCash(s, ctx, d, 'relations', src, detail);
export const morale = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale', d, src, detail);
export const moraleSafety = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('morale.safety', d, src, detail);
export const boardConf = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('board.confidence', d, src, detail);
export const secDemand = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('gov.securityDemand', d, src, detail);
export const natPressure = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('gov.nationalization', d, src, detail);
export const theftIntent = (ctx: SystemCtx, d: number, src: string, detail?: string) => ctx.bump('china.theftIntent', d, src, detail);

/** Generic 0..100 China meter (china.meters.*). */
export const chinaMeter = (ctx: SystemCtx, key: string, d: number, src: string) => ctx.bump(`china.meters.${key}`, d, src);
/** Generic 0..100 gov meter. Reg stance is −100..100 and handled by `regStance`. */
export const govMeter = (ctx: SystemCtx, key: string, d: number, src: string) => ctx.bump(`gov.${key}`, d, src);

export function regStance(s: GameStateV2, ctx: SystemCtx, d: number, src: string) {
  const before = s.gov.regStance;
  s.gov.regStance = clamp(before + d, -100, 100);
  ctx.cause('gov.regStance', s.gov.regStance - before, src);
}

/** Bloc approval (−100..100) and mobilization (0..100). Direct mutation + cause (the generic 'pub.' clamp is 0..100). */
export function bloc(s: GameStateV2, ctx: SystemCtx, id: BlocId, dApproval: number, dMob = 0, src = 'event') {
  const b = s.pub.blocs[id];
  if (!b) return;
  if (dApproval) {
    const a0 = b.approval;
    b.approval = clamp(a0 + dApproval, -100, 100);
    ctx.cause(`pub.blocs.${id}.approval`, b.approval - a0, src);
    const st = s.relations.stocks[`bloc:${id}`];
    if (st) st.trust = clamp(50 + b.approval / 2, 0, 100);
  }
  if (dMob) {
    const m0 = b.mobilization;
    b.mobilization = clamp(m0 + dMob, 0, 100);
    ctx.cause(`pub.blocs.${id}.mobilization`, b.mobilization - m0, src);
  }
}

/** Rival meters (cooperation, poach aggression, lobby stance). */
export function rivalMeter(s: GameStateV2, ctx: SystemCtx, lab: string, key: 'cooperation' | 'poachAggression' | 'lobbyStance' | 'openness', d: number, src: string) {
  const r = s.rivals.find((x) => x.core.id === lab);
  if (!r) return;
  const lo = key === 'lobbyStance' ? -100 : 0;
  const v0 = r.meters[key];
  r.meters[key] = clamp(v0 + d, lo, 100);
  ctx.cause(`rival:${lab}.${key}`, r.meters[key] - v0, src);
}

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

/** Favour token for counterparty (≤ 5, each expires after 180 days). */
export function grantFavor(s: GameStateV2, cp: CounterpartyId, days = 180) {
  const st = s.relations.stocks[cp];
  if (!st) return;
  st.favors.push(s.time.day + days);
  st.favors.sort((a, b) => a - b);
  if (st.favors.length > 5) st.favors.splice(0, st.favors.length - 5);
}

export function spendFavor(s: GameStateV2, cp: CounterpartyId): boolean {
  const st = s.relations.stocks[cp];
  if (!st || !st.favors.length) return false;
  st.favors.shift();
  return true;
}

export const hasFavor = (s: GameStateV2, cp: CounterpartyId) => (s.relations.stocks[cp]?.favors.length ?? 0) > 0;

/** Raise the access cap granted by a specific agreement (the rung itself still needs trust). */
export function grantAccess(s: GameStateV2, cp: CounterpartyId, rung: number) {
  const w = ws4(s);
  w.accessCap[cp] = Math.max(w.accessCap[cp] ?? 0, rung);
}

export const GOV_CPS: CounterpartyId[] = ['exec', 'congress', 'states'];
export const EVAL_CPS: CounterpartyId[] = ['evalGov', 'evalIndep', 'academia'];
export const ALL_PUBLIC_CPS: CounterpartyId[] = ['exec', 'congress', 'states', 'evalGov', 'evalIndep', 'academia'];
