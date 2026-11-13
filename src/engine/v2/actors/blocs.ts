// Interest blocs: pressure, coalitions, mobilization (V2-SPEC §3.10.2; research/08 §1.0). Owner: WS4.
import { BLOCS, BLOC_BY_ID, type PolicyId } from '../../../data/v2/blocs';
import type { BlocId, BlocState, GameStateV2, SystemCtx } from '../types';
import { drift } from './fx';

export function initialBlocs(): Record<BlocId, BlocState> {
  const out = {} as Record<BlocId, BlocState>;
  for (const b of BLOCS) out[b.id] = { clout: b.clout, mobilization: 20, approval: b.approval, capturedExposure: 0 };
  return out;
}

/** Pressure of a bloc on policy weight w: clout·(0.3 + 0.7·mob/100)·w. */
export function blocPressure(b: BlocState, weight: number): number {
  return b.clout * (0.3 + 0.7 * b.mobilization / 100) * weight;
}

/** Channel multiplier by who holds power (research/08 §1.0): R executive throughout; Congress flips with control. */
export function channelMult(s: GameStateV2, id: BlocId, channel: 'exec' | 'congress'): number {
  const party = channel === 'exec' ? 'R' : s.gov.congressControl;
  if (party === 'R') return id === 'populist' || id === 'accel' ? 1.3 : id === 'progressive' ? 0.6 : 1;
  if (party === 'D') return id === 'progressive' || id === 'labor' ? 1.3 : id === 'accel' ? 0.8 : id === 'populist' ? 0.9 : 1;
  return 1;
}

/** Blocs in a coalition on `policy`: ≥ 2 blocs with mobilization > 50 sharing the item at weight ≥ +2. */
export function coalition(s: GameStateV2, policy: PolicyId): BlocId[] {
  const ids = BLOCS.filter((b) => (b.agenda[policy] ?? 0) >= 2 && s.pub.blocs[b.id].mobilization > 50).map((b) => b.id);
  return ids.length >= 2 ? ids : [];
}

/** Net pressure for (+) / against (−) a policy through a channel, ≈ −100..+100 [D scale]. Coalitions ×1.25. */
export function policyPressure(s: GameStateV2, policy: PolicyId, channel: 'exec' | 'congress'): number {
  const co = new Set(coalition(s, policy));
  let sum = 0;
  for (const b of BLOCS) {
    const w = b.agenda[policy];
    if (!w) continue;
    sum += blocPressure(s.pub.blocs[b.id], w) * channelMult(s, b.id, channel) * (co.has(b.id) ? 1.25 : 1);
  }
  return sum / 3;
}

/** Daily: mobilization decays (half-life 45 d) toward a floor fed by world feeds; approval drifts to default (1 y). */
export function blocsDaily(s: GameStateV2, _ctx: SystemCtx) {
  const p = s.pub;
  const feed: Partial<Record<BlocId, number>> = {
    labor: Math.max(0, p.jobAnxiety - 70) * 1.2,
    ratepayers: Math.max(0, p.dcNimby - 45) * 0.8,
    pause: Math.max(0, p.xrisk - 45) * 0.8,
    safety: Math.max(0, p.concern - 55) * 0.6,
    parents: Math.max(0, p.companionship - 5) * 2,
    progressive: Math.max(0, p.jobAnxiety - 75) * 0.6,
  };
  for (const b of BLOCS) {
    const st = p.blocs[b.id];
    const floor = 15 + (feed[b.id] ?? 0);
    drift(s, st as unknown as Record<string, number>, 'mobilization', (floor - st.mobilization) * (Math.LN2 / 45), 0, 100, `pub.blocs.${b.id}.mobilization`);
    drift(s, st as unknown as Record<string, number>, 'approval', (BLOC_BY_ID[b.id].approval - st.approval) * (Math.LN2 / 365), -100, 100, `pub.blocs.${b.id}.approval`);
    const rel = s.relations.stocks[`bloc:${b.id}`];
    if (rel) rel.trust = Math.max(0, Math.min(100, 50 + st.approval / 2));
  }
}
