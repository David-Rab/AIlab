// Effective control and loss of control as a process (model v3 E9; MODEL-V3 §11.4). Owner: WS2.
//
// Every value is in data/v2/danger.ts CONTROL.
//   exposure E(v) = Mis(v) · (1 − O_eff(v)) · (1 + F(v))      the misaligned capacity of model v the lab can neither
//                                                              see nor undo
//     Mis      the hidden misalignment index (traits.ts misalignment)
//     O_eff    E6's internal oversight of v on the takeover act (POWER): 1 − (1 − block·(1 − r))(1 − catch·(1 − r)),
//              block = containment, catch = monitors at the capability gap, human review, control deferral (incidents.ts
//              internalOversight); r = the lineage's backdoor reach (located backdoors at half weight)
//     F        footholds' capacity outside oversight: hidden compute (share of the installed fleet ÷ 5%), escaped copies
//              0.25·(1 + log₂ copies) each, steered successors in v's lineage 2·Σ|δ|; located ones at half weight
//   control C = 1 − E (clamped), the lab's lowest over its best model and its running internal fleets (s.player.safety.
//              effectiveControl, refreshed daily by controlStep; the player sees `believed` only)
//   loss    E > θ_w = doomThreshold + ε_w (C below 1 − θ_w) while the AI can act on it:
//              · the lab's ASI (endings: resolveAsi reads its best model's exposure that day, asiControl);
//              · an escaped copy (hunted, gone quiet or never noticed) once it holds ≥ 2 copies and the lab's frontier is
//                at SAR: its own exposure Mis·(1 + 0.25·log₂ copies) (no oversight at all outside the lab).
//            ε_w ~ Logistic(0, 0.06) is drawn once per world (hidden.toleranceNoise), so with no oversight and no
//            footholds P(loss | Mis) over worlds equals v1's σ((Mis − doomThreshold)/0.06), but no ending rolls it.
// Growth once control is low (hash draws only: no named RNG stream moves):
//   · an escaped copy acquires compute: size × 2 per 30 d · (Mis/0.4) · D_w · (1 − cyber defence), ≤ 16 copies;
//   · a hidden compute reservation grows 1/60 of itself per day × its lineage's exposure × D_w, ≤ the agent pool;
//   · a backdoor raises exfiltration odds: its reach bypasses weight security and containment (incidents.ts);
//   · an escape goes unnoticed with P = 1 − C of the escaping model: a hidden copy (no alert, no hunt); its outbound
//     traffic makes it suspected at 1/180 per day × WSL/5 (footholdDetection.ts).
import { CONTROL, FOOTHOLD } from '../../../data/v2/danger';
import { computeOnlineOf } from '../compute/power';
import { hash32 } from '../core/rng';
import { internalFleets } from '../departments/agents';
import { bestPlayerVersion } from '../models/labs';
import type { Foothold, GameStateV2, ModelVersion, SystemCtx } from '../types';
import { defenceIndex } from '../worldfx/readouts';
import { clamp01 } from './common';
import { footholdsOf, isActive, lineageOf } from './footholds';
import { believedInternalOversight } from './believedOversight';
import { internalOversight } from './incidents';
import { misalignment, misalignmentEstimate } from './traits';

/** θ_w: the exposure this world tolerates (doomThreshold + its hidden tolerance noise), clamped to [0.05, 0.95]. */
export function lossThreshold(s: GameStateV2): number {
  return Math.min(0.95, Math.max(0.05, s.hidden.doomThreshold + (s.hidden.toleranceNoise ?? 0)));
}
/** The control level below which control is lost (1 − θ_w). Engine only. */
export const controlThreshold = (s: GameStateV2) => 1 - lossThreshold(s);

/** Weight of a foothold's effect: removed 0; located (in the lab) half; hidden, suspected or any escaped copy 1. */
function weight(f: Foothold): number {
  if (!isActive(f)) return 0;
  if (f.kind === 'exfiltratedCopy') return 1;
  return f.status === 'detected' ? CONTROL.locatedWeight : 1;
}

/** An escaped copy's capacity in F: copyBase · (1 + log₂ copies). */
export const copyF = (size: number) => CONTROL.copyBase * (1 + Math.log2(Math.max(1, size)));

/** Backdoor reach of a lineage for control (located backdoors at half weight). */
function reachOf(s: GameStateV2, lin: string): number {
  let miss = 1;
  for (const f of footholdsOf(s)) if (f.kind === 'backdoor' && f.lineage === lin) miss *= 1 - weight(f) * f.size;
  return Math.min(FOOTHOLD.reachMax, 1 - miss);
}

export interface ControlTerms {
  versionId: string;
  mis: number;
  /** E6 oversight on the takeover act, the lineage's backdoor reach and the oversight left after it. */
  oversight: number; reach: number; oEff: number;
  /** Footholds' capacity: hidden compute, escaped copies, steered successors, total F. */
  hiddenCompute: number; copies: number; steered: number; F: number;
  exposure: number; control: number;
}

/** Hidden compute capacity in F: Σ weight·H100e ÷ installed fleet ÷ hidCompFull (lab-wide: the misaligned fleet's). */
function hiddenComputeF(s: GameStateV2): number {
  const installed = computeOnlineOf(s);
  if (installed <= 0) return 0;
  let h = 0;
  for (const f of footholdsOf(s)) if (f.kind === 'hiddenCompute') h += weight(f) * f.size;
  return h / installed / CONTROL.hidCompFull;
}

/** Escaped copies' capacity in F (lab-wide: outside the lab, they coordinate with any misaligned fleet). */
function copiesF(s: GameStateV2): number {
  let x = 0;
  for (const f of footholdsOf(s)) if (f.kind === 'exfiltratedCopy') x += weight(f) * copyF(f.size);
  return x;
}

/** Steered successors in v's lineage (made by it, or steering v itself or its base): steeredPerPull · Σ weight·|δ|. */
function steeredF(s: GameStateV2, v: ModelVersion, lin: string): number {
  let x = 0;
  for (const f of footholdsOf(s)) {
    if (f.kind !== 'steeredSuccessor' || !f.delta) continue;
    if (f.lineage !== lin && f.ref !== v.id && f.ref !== v.baseId) continue;
    x += weight(f) * Object.values(f.delta).reduce((a, d) => a + Math.abs(d ?? 0), 0);
  }
  return CONTROL.steeredPerPull * x;
}

/** Control terms of model v (TRUE traits, levels and footholds). Engine only. */
export function controlTerms(s: GameStateV2, v: ModelVersion): ControlTerms {
  const lin = lineageOf(s, v);
  const o = internalOversight(s, v, CONTROL.trait);
  const reach = reachOf(s, lin);
  const oEff = 1 - (1 - o.block * (1 - reach)) * (1 - o.catch * (1 - reach));
  const hiddenCompute = hiddenComputeF(s);
  const copies = copiesF(s);
  const steered = steeredF(s, v, lin);
  const F = hiddenCompute + copies + steered;
  const mis = misalignment(v.traitsTrue, v.uModes);
  const exposure = mis * (1 - oEff) * (1 + F);
  return { versionId: v.id, mis, oversight: o.oversight, reach, oEff, hiddenCompute, copies, steered, F, exposure, control: clamp01(1 - exposure) };
}

/** The models whose control counts: the lab's best model (its ASI when it gets there) and each running internal fleet. */
function candidates(s: GameStateV2): ModelVersion[] {
  const out: ModelVersion[] = [];
  const best = bestPlayerVersion(s);
  if (best) out.push(best);
  for (const fl of internalFleets(s)) if (fl.v.status !== 'retired' && !out.includes(fl.v)) out.push(fl.v);
  return out;
}

/** The lab's effective control today: the lowest over its candidates (undefined with no model). Engine only. */
export function labControl(s: GameStateV2): ControlTerms | undefined {
  let worst: ControlTerms | undefined;
  for (const v of candidates(s)) {
    const t = controlTerms(s, v);
    if (!worst || t.exposure > worst.exposure) worst = t;
  }
  return worst;
}

/** Control terms of the lab's ASI model at the ASI check: its best version, the model capable enough to act (the
 *  lab-wide footholds, hidden compute and escaped copies, count for it). Engine only. */
export function asiControl(s: GameStateV2): ControlTerms | undefined {
  const v = bestPlayerVersion(s);
  return v ? controlTerms(s, v) : undefined;
}

/** Is control of the lab's AI lost (exposure above the world's tolerance)? The caller gates on capability. */
export const controlLost = (s: GameStateV2, t: Pick<ControlTerms, 'exposure'>) => t.exposure > lossThreshold(s);

// ───────────────────────────── escaped copies ─────────────────────────────

/** Misalignment index of an escaped copy (stored at escape; else its version's today). */
function copyMis(s: GameStateV2, f: Foothold): number {
  if (f.mis !== undefined) return f.mis;
  const v = s.player.models.versions.find((x) => x.id === f.versionId);
  return v ? misalignment(v.traitsTrue, v.uModes) : 0;
}

/** An escaped copy's own exposure (no oversight outside the lab): Mis · (1 + copyBase · log₂ copies). */
export function copyExposure(s: GameStateV2, f: Foothold): number {
  return copyMis(s, f) * (1 + CONTROL.copyBase * Math.log2(Math.max(1, f.size)));
}

/** Daily doubling rate of an escaped copy's compute (log₂ per day): (1/copyDoubling)·(Mis/misRef)·D_w·(1 − cyber defence). */
export function copyGrowthRate(s: GameStateV2, f: Foothold): number {
  return (copyMis(s, f) / CONTROL.misRef) * s.hidden.difficultyMult * (1 - defenceIndex(s, 'cyber')) / CONTROL.copyDoubling;
}

/** The escaped copy that takes control today, if any: grown to copyActs copies, exposure above the world's tolerance,
 *  and the lab's frontier at SAR (v2's gate on the rogue clock). Engine only. */
export function rogueCopy(s: GameStateV2): Foothold | undefined {
  if (s.player.milestoneDays[4] === undefined) return undefined; // RD-L05: the SAR milestone predicate (was λ ≥ 12)
  const thr = lossThreshold(s);
  return footholdsOf(s).find((f) => f.kind === 'exfiltratedCopy' && isActive(f) && f.size >= CONTROL.copyActs && copyExposure(s, f) > thr);
}

/** Does security notice an escape of model v today? P = the lab's control of v (hash draw; no named stream moves). */
export function escapeNoticed(s: GameStateV2, v: ModelVersion, day: number): boolean {
  const u = hash32(s.setup.seed, `control:escape:${v.id}:${day}`) / 4294967296;
  return u < controlTerms(s, v).control;
}

// ───────────────────────────── the player's estimate ─────────────────────────────

/** The lab's believed control of model v: its belief estimate of Mis, believed oversight (E15: believedOversight.ts,
 *  the same terms as the danger readout: believed tool strengths and masks, measured levels, no U-modes), and only the
 *  footholds it knows of (located at their size, suspected ones at suspectedF each). */
export function believedTerms(s: GameStateV2, v: ModelVersion): { mis: number; oversight: number; F: number; exposure: number; control: number } {
  const o = believedInternalOversight(s, v, CONTROL.trait);
  const lin = lineageOf(s, v);
  let F = 0;
  let miss = 1;
  const installed = computeOnlineOf(s);
  for (const f of footholdsOf(s)) {
    if (f.status === 'hidden' || f.status === 'removed') continue;
    if (f.status === 'suspected') { F += CONTROL.suspectedF; continue; }
    if (f.kind === 'hiddenCompute' && installed > 0) F += (weight(f) * f.size) / installed / CONTROL.hidCompFull;
    else if (f.kind === 'exfiltratedCopy') F += copyF(f.size);
    else if (f.kind === 'steeredSuccessor' && (f.lineage === lin || f.ref === v.id || f.ref === v.baseId)) F += weight(f) * CONTROL.steeredPerPull * Object.values(f.delta ?? {}).reduce((a, d) => a + Math.abs(d ?? 0), 0);
    else if (f.kind === 'backdoor' && f.lineage === lin) miss *= 1 - weight(f) * f.size;
  }
  const reach = 1 - miss;
  const oEff = 1 - (1 - o.block * (1 - reach)) * (1 - o.catch * (1 - reach));
  const mis = misalignmentEstimate(v);
  const exposure = mis * (1 - oEff) * (1 + F);
  return { mis, oversight: oEff, F, exposure, control: clamp01(1 - exposure) };
}

/** What the player sees (E11's control readout): the believed control of the lab's AI and the model it is lowest for.
 *  Never the true level or the world's threshold (R9). */
export function controlView(s: GameStateV2): { believed: number; versionId?: string } {
  const c = s.player.safety.effectiveControl;
  return { believed: c?.believed ?? 1, versionId: c?.versionId };
}

// ───────────────────────────── daily step ─────────────────────────────

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Daily (incidents system, after the footholds' symptoms): footholds grow once control is low (escaped copies acquire
 *  compute, hidden compute reservations launch more jobs), then today's control is stored. */
export function controlStep(s: GameStateV2, ctx: SystemCtx): void {
  void ctx;
  const fs = footholdsOf(s);
  if (fs.length) {
    let fleets: { v: ModelVersion; usage: number }[] | undefined;
    for (const f of fs) {
      if (!isActive(f)) continue;
      if (f.kind === 'exfiltratedCopy') {
        if (f.size < CONTROL.copyMax) f.size = Math.min(CONTROL.copyMax, f.size * Math.pow(2, copyGrowthRate(s, f)));
      } else if (f.kind === 'hiddenCompute' && f.status !== 'detected') {
        fleets ??= internalFleets(s);
        let e = 0;
        for (const fl of fleets) if (fl.usage > 0 && fl.v.status !== 'retired' && lineageOf(s, fl.v) === f.lineage) e = Math.max(e, controlTerms(s, fl.v).exposure);
        if (e <= 0) continue;
        const pool = Math.max(0, s.player.computeOnline * ((s.player.split.routine + s.player.split.frontier)));
        f.size = Math.min(Math.max(f.size, pool), f.size * (1 + CONTROL.hidCompGrowth * e * s.hidden.difficultyMult));
      }
    }
  }
  const t = labControl(s);
  const c = (s.player.safety.effectiveControl ??= { level: 1, exposure: 0, lowest: 1, believed: 1 });
  if (!t) return;
  c.level = round4(t.control);
  c.exposure = round4(t.exposure);
  c.lowest = Math.min(c.lowest ?? 1, c.level);
  // E15: the shown model and its control are the lowest BELIEVED control over the same candidates (never the model
  // where true control is lowest).
  const b = believedLowest(s);
  c.versionId = b?.versionId;
  c.believed = b ? round4(b.control) : 1;
}

/** The candidate with the lowest believed control (the player's view: beliefs, measured levels, known footholds). */
export function believedLowest(s: GameStateV2): { versionId: string; control: number } | undefined {
  let out: { versionId: string; control: number } | undefined;
  for (const v of candidates(s)) {
    const control = believedTerms(s, v).control;
    if (!out || control < out.control) out = { versionId: v.id, control };
  }
  return out;
}
