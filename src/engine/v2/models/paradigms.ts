// Paradigm research projects with hidden success (V2-SPEC §3.3.3). Owner: WS1.
//   progress/day = (fte/30)^0.5 · (expShare/0.02)^0.3 / effortDays
//   at progress 1 the hidden success is revealed: success → 'succeeded' (adopt separately); failure → 'failed', retry
//   after 180 d at prior × 0.5. Tier gates use the MEASURED level.
import {
  PARADIGMS, PARADIGM_DOMAIN_OFF, PARADIGM_REF_EXP, PARADIGM_REF_FTE, PARADIGM_RETRY_DAYS, TIER_MIN_L, type ParadigmDef,
} from '../../../data/v2/paradigms';
import type { DomainId, GameStateV2, ParadigmState, SystemCtx } from '../types';
import { bestMeasuredL } from './labs';

export const PARADIGM_BY_ID = Object.fromEntries(PARADIGMS.map((p) => [p.id, p])) as Record<string, ParadigmDef>;

/** Start state: P01–P04 adopted, other tier-1 available, the rest locked. */
export function initialParadigms(): Record<string, ParadigmState> {
  const out: Record<string, ParadigmState> = {};
  for (const p of PARADIGMS) {
    const isAdopted = p.effortDays === 0;
    const open = p.tier === 1 && !p.g;
    out[p.id] = { status: isAdopted ? 'adopted' : open ? 'available' : 'locked', progress: isAdopted ? 1 : 0, fte: 0, expShare: 0 };
    if (isAdopted) out[p.id].revealedDay = 0;
  }
  return out;
}

/** Whether the player has adopted paradigm `id`. */
export const adopted = (s: GameStateV2, id: string) => s.player.paradigms[id]?.status === 'adopted';

/** Domain offsets from adopted paradigms (applied to new versions). */
export function paradigmOff(s: GameStateV2): Partial<Record<DomainId, number>> {
  const out: Partial<Record<DomainId, number>> = {};
  for (const [id, off] of Object.entries(PARADIGM_DOMAIN_OFF)) {
    if (!adopted(s, id)) continue;
    for (const [d, v] of Object.entries(off) as [DomainId, number][]) out[d] = (out[d] ?? 0) + v;
  }
  return out;
}

/** Best measured domain level across non-retired versions (benchmark-based, visible). */
function measuredDomain(s: GameStateV2, d: DomainId): number {
  let best = 0;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.evals.measuredL === undefined) continue;
    best = Math.max(best, v.domains[d] + (v.evals.measuredL - v.Lg)); // measured offset applied to the domain
  }
  return best;
}

/** Why a paradigm is not yet open, or true (§3.3.3 tier gates). */
export function paradigmGate(s: GameStateV2, id: string): true | string {
  const p = PARADIGM_BY_ID[id];
  if (!p) return 'unknown paradigm';
  const L = bestMeasuredL(s);
  const g = p.g ?? {};
  const minL = Math.max(TIER_MIN_L[p.tier], g.minL ?? 0);
  if (L < minL) return `Needs measured level ${minL}`;
  for (const r of g.requires ?? []) if (!adopted(s, r)) return `Needs ${r}`;
  for (const r of g.partial ?? []) if ((s.player.paradigms[r]?.progress ?? 0) < 0.5 && !adopted(s, r)) return `Needs ${r} half done`;
  if (g.multimodalBase && !s.player.models.bases.some((b) => b.design.data === 'multimodal')) return 'Needs a multimodal base';
  if (g.cash !== undefined && s.player.finance.cash < g.cash) return `Needs $${g.cash}B cash`;
  if (g.agendaTech && !s.player.safety.findings.some((f) => f.agenda === g.agendaTech && f.type === 'TECH')) return `Needs a ${g.agendaTech} technique`;
  if (g.domain && measuredDomain(s, g.domain.id) < g.domain.min) return `Needs ${g.domain.id} ≥ ${g.domain.min}`;
  if (g.inference !== undefined && s.player.computeOnline * s.player.split.agents < g.inference) return 'Needs a larger agents pool';
  if (g.milestone !== undefined && s.player.milestoneDays[g.milestone as 4] === undefined) return 'Needs a superhuman AI researcher';
  return true;
}

/** Fund (or re-staff) a paradigm project. fte = 0 pauses it. Returns an error string or undefined. */
export function fundParadigm(s: GameStateV2, id: string, fte: number, expShare: number): string | undefined {
  const st = s.player.paradigms[id];
  if (!st) return 'unknown paradigm';
  if (st.status === 'adopted' || st.status === 'succeeded') return 'Already done';
  if (st.status === 'failed' && (st.retryDay ?? 0) > s.time.day) return `Retry after day ${st.retryDay}`;
  const gate = paradigmGate(s, id);
  if (gate !== true && st.status !== 'researching') return gate;
  if (st.status === 'failed') {
    st.progress = 0;
    st.attempts = (st.attempts ?? 1) + 1;
  }
  st.fte = Math.max(0, Math.round(fte));
  st.expShare = Math.max(0, Math.min(0.2, expShare));
  st.status = st.fte > 0 ? 'researching' : 'available';
  return undefined;
}

/** Adopt a succeeded paradigm (§3.3.3). */
export function adoptParadigm(s: GameStateV2, id: string): string | undefined {
  const st = s.player.paradigms[id];
  if (!st || st.status !== 'succeeded') return 'Not available to adopt';
  st.status = 'adopted';
  return undefined;
}

/** Research FTE and experiment-pool share tied up in paradigm projects (they come out of h and c). */
export function paradigmLoad(s: GameStateV2): { fte: number; expShare: number } {
  let fte = 0;
  let expShare = 0;
  for (const st of Object.values(s.player.paradigms)) {
    if (st.status !== 'researching') continue;
    fte += st.fte;
    expShare += st.expShare;
  }
  return { fte, expShare: Math.min(0.9, expShare) };
}

/** Daily paradigm progress and reveal of hidden success (called by the runs system). */
export function advanceParadigms(s: GameStateV2, ctx: SystemCtx): void {
  for (const p of PARADIGMS) {
    const st = s.player.paradigms[p.id];
    if (!st) continue;
    if (st.status === 'locked' && paradigmGate(s, p.id) === true) {
      st.status = 'available';
      ctx.log('research', `New research direction open: ${p.name}.`, 1, p.id);
    }
    if (st.status !== 'researching' || st.fte <= 0 || p.effortDays <= 0) continue;
    const rate = Math.sqrt(st.fte / PARADIGM_REF_FTE) * Math.pow(Math.max(1e-4, st.expShare) / PARADIGM_REF_EXP, 0.3) / p.effortDays;
    st.progress = Math.min(1, st.progress + rate);
    if (st.progress < 1) continue;
    // Reveal. First attempt uses the hidden draw from newGame; retries redraw at prior × priorMult.
    const ok = (st.attempts ?? 1) <= 1 ? s.hidden.paradigmSuccess[p.id] === true : ctx.rng('runs').chance(p.prior * (st.priorMult ?? 0.5));
    st.revealedDay = ctx.day;
    st.fte = 0;
    st.expShare = 0;
    if (ok) {
      st.status = 'succeeded';
      ctx.log('research', `${p.name} works. Ready to adopt.`, 2, p.id);
    } else {
      st.status = 'failed';
      st.retryDay = ctx.day + PARADIGM_RETRY_DAYS;
      st.priorMult = (st.priorMult ?? 1) * 0.5;
      ctx.log('research', `${p.name}: dead end for now.`, 2, p.id);
    }
  }
}
