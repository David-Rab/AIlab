// AI integration and control index; leverage per lineage (V2-SPEC §3.11.2; research/16 §2). Owner: WS5.
//
//   Ctrl_dom = P_dom · Σ_tier mix·weight     weights T0 0.1, T1 0.3·Accept, T2 0.6, T3 1.0
//   Lev_X    = Σ_dom W_dom · Ctrl_dom · Share_X,dom      W: ECON .25, GOV .20, MIL .30, INFRA .25
//   P_dom   += k_dom·(Target_dom − P_dom)/365;  Target = f(adoption, contracts, briefings, race, techs)
// Thresholds: Lev ≥ 0.15 Entrenched, ≥ 0.35 Indispensable, ≥ 0.6 (+ robots > 10% of labor or W25) Decisive.
import { SECTORS } from '../../../data/v2/sectors';
import { DOMAIN_IDS } from '../../../data/v2/calibration';
import { internalVersion } from '../models/labs';
import { domainScaleG, gOfLevel, levelGate, levelOfG, v2LevelGate } from '../models/capability';
import type { ControlDomainId, ControlState, GameStateV2, LabId, SectorId, SystemCtx } from '../types';
import { paidDeployments, productGVec, type WorldMix } from './mix';
import { clamp01, techRamp } from './util';
import { worldTechEffects } from './techtree';

export const CONTROL_DOMAINS: ControlDomainId[] = ['ECON', 'GOV', 'MIL', 'INFRA'];
export const CONTROL_W: Record<ControlDomainId, number> = { ECON: 0.25, GOV: 0.2, MIL: 0.3, INFRA: 0.25 };
export const TIER_W = [0.1, 0.3, 0.6, 1.0] as const; // T1 × Accept
export const LEVERAGE_THRESHOLDS = { entrenched: 0.15, indispensable: 0.35, decisive: 0.6 } as const;
const K_DOM: Record<ControlDomainId, number> = { ECON: 2, GOV: 1.5, MIL: 1, INFRA: 1.5 }; // per year [D]
/** T1 Accept = base + gain·σ((L_REASON − mid)/spread) + 0.2·persuasion; humans defer to superhuman advice
 *  ("authorities almost always accept its recommendations" → 0.9 by Dec 2027 [A27]) [D, fit §7.3].
 *  Model v3 G1 refit of `mid` (worldfx "Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85", target 2027-12-15, on the median first
 *  day over the 20 classic RefBot runs of CAL_SEEDS): 9.5 was fitted while the median world ran 0.17 y late; on the
 *  calibrated path (F4) the advisor reached the level ≥ 0.85 needs (≈ mid + 1.4) in Aug 2027. 9.5 → 11.5: median
 *  2027-08-18 → 2027-12-16 (10.0 −88 d, 10.5 −53 d, 11.0 −24 d, 11.25 −11 d, 11.5 +2 d); Accept ≥ 0.85 now needs the
 *  government advisor near L 12.9, between SAR (12) and SIAR (13.5), as AI 2027 places it (design/archive/notes/G1.md). */
export const ACCEPT = { base: 0.3, gain: 0.65, mid: 11.5, spread: 0.8, rate: 6 };

export function initialControl(shareRow: () => Record<LabId, number>): Record<ControlDomainId, ControlState> {
  // Jul 2025 [D], below R16's Nov 2026 anchors (ECON 8%, GOV 3%, MIL 2%, INFRA 5%).
  const c = (P: number, cap: ControlState['tierCap']): ControlState => ({ P, tiers: [0.75, 0.25, 0, 0], accept: 0.3, tierCap: cap, shares: shareRow() });
  return { ECON: c(0.05, 3), GOV: c(0.02, 3), MIL: c(0.01, 1), INFRA: c(0.03, 3) };
}

/** Control index of one domain. */
export function ctrlOf(c: ControlState): number {
  const t = c.tiers;
  return c.P * (t[0] * TIER_W[0] + t[1] * TIER_W[1] * c.accept + t[2] * TIER_W[2] + t[3] * TIER_W[3]);
}

/** Leverage Lev_X = Σ_dom W_dom · Ctrl_dom · Share_X,dom for a lab (sums its lineage keys, e.g. 'player'). The
 *  player's open-weights release ('player:open') is not the player's leverage. */
export function leverage(s: GameStateV2, lab: LabId): number {
  let lev = 0;
  for (const d of CONTROL_DOMAINS) {
    const c = s.world.control[d];
    lev += CONTROL_W[d] * ctrlOf(c) * (c.shares[lab] ?? 0);
  }
  return lev;
}

/** Leverage of every lineage key in the control shares (player, rivals, china, player:open). */
export function leverageAll(s: GameStateV2): Record<string, number> {
  const keys = new Set<string>();
  for (const d of CONTROL_DOMAINS) for (const k of Object.keys(s.world.control[d].shares)) keys.add(k);
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = leverage(s, k);
  return out;
}

export type LeverageTier = 'none' | 'entrenched' | 'indispensable' | 'decisive';
export function leverageTier(s: GameStateV2, lev: number): LeverageTier {
  const robotsHigh = s.world.robots.stockHWE * s.world.fx.robotUS > 0.1 * 170e6;
  if (lev >= LEVERAGE_THRESHOLDS.decisive && (robotsHigh || (s.world.techs.W25?.discoveredDay !== undefined))) return 'decisive';
  if (lev >= LEVERAGE_THRESHOLDS.indispensable) return 'indispensable';
  if (lev >= LEVERAGE_THRESHOLDS.entrenched) return 'entrenched';
  return 'none';
}

/** Persuasion_X = INFO_share_X · σ((L_SOCIAL − 10)/1.5), ×(1 + W23 ramp effect) (R16 §2.1). RD-P04b: on the consumer
 *  model's SOCIAL domain G (OOM), the L 10 / 1.5 L gate through the one λ. CAL2-X: R16's SOCIAL 10 is a v2 level (its profile's
 *  Agent-4) → v2LevelGate. */
export function persuasion(s: GameStateV2, lab: LabId, mix?: WorldMix): number {
  const share = s.world.infoShare[lab] ?? 0;
  const w = s.hidden.timeline;
  let social = gOfLevel(w, 0);
  if (mix) {
    const i = mix.providers.findIndex((p) => p.key === lab);
    if (i >= 0) social = mix.consumer.US.socialGs[i];
  } else social = mixSocialFallback(s, lab);
  return share * v2LevelGate(w, 'SOCIAL', social, 10, 1.5) * (1 + 0.5 * techRamp(s, 'W23'));
}
const SOCIAL_IX = DOMAIN_IDS.indexOf('SOCIAL');
function mixSocialFallback(s: GameStateV2, lab: LabId): number {
  const w = s.hidden.timeline;
  let best = gOfLevel(w, 0);
  if (lab === 'player') {
    for (const d of paidDeployments(s)) {
      const v = s.player.models.versions.find((x) => x.id === d.versionId);
      if (v) best = Math.max(best, productGVec(s, d, v)[SOCIAL_IX]);
    }
    return best;
  }
  const r = lab === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === lab);
  return r?.publicModel ? domainScaleG(w, r.publicModel, 'SOCIAL') : best;
}

function sharesWeighted(mix: WorldMix, secs: SectorId[], weights: number[]): Record<LabId, number> {
  const out: Record<LabId, number> = {};
  let tot = 0;
  secs.forEach((sid, j) => {
    const m = mix.sec.US[sid];
    mix.providers.forEach((p, i) => {
      if (!m.share[i]) return;
      out[p.key] = (out[p.key] ?? 0) + m.share[i] * weights[j];
    });
    tot += weights[j];
  });
  for (const k of Object.keys(out)) out[k] = Math.round((out[k] / tot) * 1e4) / 1e4;
  return out;
}

/** Binomial(3, a) tier mix with mass above the cap collapsed onto the cap. */
function tierMix(a: number, cap: number): [number, number, number, number] {
  const b = (k: number) => [1, 3, 3, 1][k] * Math.pow(a, k) * Math.pow(1 - a, 3 - k);
  const t: [number, number, number, number] = [b(0), b(1), b(2), b(3)];
  for (let k = 3; k > cap; k--) {
    t[cap] += t[k];
    t[k] = 0;
  }
  return t;
}

/** Best REASON domain G (OOM, general λ scale) available to government advisers: the GOV market's models, Vetted (MK-1: was gov-channel)
 *  products, and briefings on the internal frontier (each briefing level below 3 costs 0.5 levels of access [D], applied
 *  through the one λ: λ⁻¹(λ(G) − 0.5·(3 − b))). RD-P04b: was the same in display levels. */
export function govAdviceG(s: GameStateV2, mix: WorldMix): number {
  const w = s.hidden.timeline;
  let g = mix.sec.US.GOV.g.REASON;
  for (const d of paidDeployments(s)) if (d.channel === 'vetted') {
    const v = s.player.models.versions.find((x) => x.id === d.versionId);
    if (v) g = Math.max(g, productGVec(s, d, v)[REASON_IX]);
  }
  const b = s.player.policies.govBriefing;
  const iv = internalVersion(s);
  if (b >= 1 && iv) g = Math.max(g, gOfLevel(w, levelOfG(w, domainScaleG(w, iv, 'REASON')) - (3 - b) * 0.5));
  return g;
}
const REASON_IX = DOMAIN_IDS.indexOf('REASON');

/** Daily control update (called from worldDaily). No law acts here: the US human-in-the-loop mandate caps substitution
 *  in the sectors (worldfx/sectors.ts), and the other old policy terms (government AI advisors, arms race, human
 *  judgment over force removed, advice transparency, multi-vendor) are gone with the old government actor. */
export function updateControl(s: GameStateV2, _ctx: SystemCtx, mix: WorldMix): void {
  const W = s.world;
  const US = W.sectors.US;
  const dt = 1 / 365;
  const eff = worldTechEffects(s);
  const deps = paidDeployments(s);
  const govDep = deps.some((d) => d.channel === 'vetted');
  const milOk = govDep && !deps.every((d) => d.channel !== 'vetted' || d.usagePolicy.noAutonomousWeapons);
  const iv = internalVersion(s);
  const w = s.hidden.timeline;
  const hasInternal = s.player.deployments.some((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  // RD-P04b: the internal model's AGENCY / REASON domain G (OOM); v2's level gates through the one λ (levelGate). CAL2-X:
  // the REASON / CYBER gates are v2 levels read through the per-world conversion (v2LevelGate); AGENCY has no RD-U05 shift.
  const ivAg = iv ? domainScaleG(w, iv, 'AGENCY') : 0;
  const ivR = iv ? domainScaleG(w, iv, 'REASON') : 0;
  const internalOps = hasInternal && iv ? 0.15 * levelGate(w, ivAg, 10, 1) : 0;
  const pressure = Math.max(0, ...s.rivals.map((r) => r.pressure));

  // Private-sector weights for ECON.
  const econSecs = SECTORS.filter((d) => d.econWeight > 0);
  const econW = econSecs.map((d) => d.empPct * d.wage * d.econWeight);
  const econWsum = econW.reduce((a, b) => a + b, 0);
  let econP = 0;
  econSecs.forEach((d, i) => (econP += econW[i] * US[d.id].A));
  econP /= econWsum;

  const govAdv = govAdviceG(s, mix);
  const target: Record<ControlDomainId, number> = {
    ECON: econP,
    // Officials adopt superhuman advisers (AI 2027 Dec 2027: Cabinet talks to the model "for hours a day") [D].
    GOV: US.GOV.A + (govDep ? 0.05 : 0) + 0.01 * s.player.policies.govBriefing + 0.35 * v2LevelGate(w, 'REASON', govAdv, 12, 1),
    MIL: US.MIL.A + (milOk ? 0.03 : 0) + eff.milP + 0.1 * v2LevelGate(w, 'REASON', govAdv, 12, 1),
    INFRA: 0.5 * US.ENGY.A + 0.25 * US.SOFT.A + eff.infraP + internalOps + 0.2 * v2LevelGate(w, 'CYBER', mix.bestPublic.CYBER, 11, 1),
  };


  let topPers = 0;
  for (const p of mix.providers) topPers = Math.max(topPers, persuasion(s, p.key, mix));

  for (const dom of CONTROL_DOMAINS) {
    const c = W.control[dom];
    c.P = clamp01(c.P + K_DOM[dom] * (clamp01(target[dom]) - c.P) * dt);
    // Domain models' AGENCY / REASON domain G (OOM; RD-P04b: the market's share-weighted G, SectorMix.g).
    const secMix = dom === 'GOV' ? mix.sec.US.GOV : dom === 'MIL' ? mix.sec.US.MIL : dom === 'INFRA' ? mix.sec.US.ENGY : mix.sec.US.FIN;
    let Lag = secMix.g.AGENCY;
    let Lr = dom === 'GOV' || dom === 'MIL' ? govAdv : secMix.g.REASON;
    if (dom === 'INFRA' && internalOps > 0 && iv) {
      Lag = Math.max(Lag, ivAg * 0.5 + Lag * 0.5);
      Lr = Math.max(Lr, ivR * 0.5 + Lr * 0.5);
    }
    // Tier cap: DoDD 3000.09-style human judgment over force holds (no law removes it).
    const cap: ControlState['tierCap'] = dom === 'MIL' ? 1 : 3;
    c.tierCap = cap;
    const a = clamp01(levelGate(w, Lag, 9.5, 1.2) + 0.25 * pressure + 0.2 * v2LevelGate(w, 'REASON', Lr, 12, 0.5) - 0.03);
    const tgt = tierMix(a, cap);
    for (let k = 0; k < 4; k++) c.tiers[k] += (tgt[k] - c.tiers[k]) * 2 * dt;
    const accStar = clampR01(ACCEPT.base + ACCEPT.gain * v2LevelGate(w, 'REASON', Lr, ACCEPT.mid, ACCEPT.spread) + 0.2 * topPers, 0.98);
    c.accept += (accStar - c.accept) * ACCEPT.rate * dt;
    // Shares by lineage key.
    let sh: Record<LabId, number>;
    if (dom === 'ECON') sh = sharesWeighted(mix, econSecs.map((d) => d.id), econW);
    else if (dom === 'GOV') sh = sharesWeighted(mix, ['GOV'], [1]);
    else if (dom === 'MIL') sh = sharesWeighted(mix, ['MIL'], [1]);
    else {
      sh = sharesWeighted(mix, ['ENGY', 'SOFT'], [2, 1]);
      const io = target.INFRA > 0 ? internalOps / target.INFRA : 0;
      for (const k of Object.keys(sh)) sh[k] *= 1 - io;
      sh.player = (sh.player ?? 0) + io;
    }
    c.shares = sh;
  }
}

const clampR01 = (x: number, hi: number) => (x < 0 ? 0 : x > hi ? hi : x);
