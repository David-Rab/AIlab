// Loss-of-control risk and Unstopped harm / yr: the SAFETY headline (SR-04; SAFETY-REDESIGN §2.2 concept 12, §2.4;
// OD-1, OD-2). Output only: no state changes, no RNG. Owner: WS2.
//
// Loss-of-control risk of a model v = the player's BELIEVED odds that the engine's loss test fails for it
// (control.ts: exposure E = Mis · (1 − O_eff) · (1 + F) against θ_w = doomThreshold + ε_w), always "if it could act now"
// (OD-2: the engine checks it when v is its lab's ASI, or an escaped copy once the frontier is at SAR):
//   Mis      the belief on v's misalignment: Normal(m̂, σ̂), m̂ = misalignmentEstimate, σ̂ = misalignmentSd (trait beliefs
//            independent normals, Mis linear in them; clamped to [0, 1] as the engine clamps Mis). ASSUMPTION: belief
//            sd's are treated as independent normal errors, integrated on a 4σ grid.
//   O_eff    the believed stop rate of the "Acts against the lab" row (believedInternalOversight on the takeover act,
//            the same terms as actTable's composite row) after the backdoor reach the lab believes in.
//   F, reach footholds the lab knows of: located at their size and half weight (CONTROL.locatedWeight); suspected ones at
//            full weight and the TYPICAL size of their kind (kind and lineage are visible; size is not): a backdoor
//            reachPerSev · (floor + span/2), a hidden compute reservation hidCompPerSev · (floor + span/2) of the agent
//            pool; other suspected kinds CONTROL.suspectedF each (as believedTerms); escaped copies copyF(size).
//            Plus the UNFOUND allowance: the believed table's expected unstopped BACKDOOR and HIDCOMP acts over
//            UNFOUND_YEARS, each a full-weight foothold of the typical size (item acts are not in it: the table has no
//            believed count of items per year).
//   θ        the published prior, never the world's draw: doomThreshold 0.40 (U(0.30, 0.50) when the setup samples
//            alignment) + ε, ε ~ Logistic(0, CONTROL.toleranceSd), clamped to [0.05, 0.95] (control.ts lossThreshold).
// P(loss | v) = E_Mis[ P(θ < Mis · k) ], k = (1 − O_eff)(1 + F). Lab headline = the max over the models it runs (its best
// model, its internal fleets, its live products' models), labelled with that model.
// Unstopped harm / yr = Σ over every site's believed act table of per-year rows' Unstopped × their expected severity
// (floor + span · Able to · autonomy · affordance, the incident severity rule's mean; escapes severity 5; misuse
// MISUSE.floor + span · Able to). Per-item rows and the composite row are left out (the composite row is the headline).
import { COVERT_ACTS, CONTROL, DANGER_ACTS, FOOTHOLD, MISUSE } from '../../../data/v2/danger';
import { computeOnlineOf } from '../compute/power';
import { internalFleets } from '../departments/agents';
import { bestMeasuredVersion } from '../models/labs';
import { believedRdShare } from '../departments/workfit';
import type { Foothold, GameStateV2, ModelVersion, TraitId } from '../types';
import { clamp01, sigmoid, versionById } from './common';
import { actTable, type ActTable } from './actTable';
import { believedInternalOversight } from './believedOversight';
import { copyF } from './control';
import { footholdsOf, isActive, lineageOf } from './footholds';
import { misalignmentEstimate, misalignmentSd } from './traits';

/** Years of the table's expected unstopped covert acts counted as unfound footholds [D]. */
export const UNFOUND_YEARS = 1;
/** The published centre of what the world tolerates and the sampled range (data/world.ts: 0.40; U(0.30, 0.50)). */
export const THETA_PRIOR = { centre: 0.4, lo: 0.3, hi: 0.5 };
const Z90 = 1.64;
const GRID = 81;
const typicalSev = (id: 'BACKDOOR' | 'HIDCOMP') => COVERT_ACTS[id].floor + COVERT_ACTS[id].span / 2;

/** What-if inputs (Risk levers): shift the belief mean, scale its sd, add stop rate, ignore footholds. */
export interface LossMods { misShift?: number; sdMult?: number; stopAdd?: number; noFootholds?: boolean }

export interface LossRisk {
  versionId: string; name: string;
  /** Believed P(loss) and its 90% range (Mis at the belief's 5th / 95th percentile, θ at its prior). */
  p: number; lo: number; hi: number;
  /** Its parts: belief on Mis, believed stop rate, footholds (known + unfound) and the backdoor reach in O_eff. */
  mis: number; misSd: number; stopRate: number; F: number; reach: number;
  knownF: number; unfoundF: number; unfoundReach: number;
  /** Exposure at the belief mean: mis · (1 − stopRate) · (1 + F). */
  exposure: number;
}

const softplus = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));

/** P(θ < x) under the published prior (θ clamped to [0.05, 0.95] as lossThreshold clamps it). Never reads s.hidden. */
export function thetaCdf(s: GameStateV2, x: number): number {
  if (x <= 0.05) return 0;
  if (x > 0.95) return 1;
  const w = CONTROL.toleranceSd;
  if (s.setup.alignment !== 'sampled') return sigmoid((x - THETA_PRIOR.centre) / w);
  // d ~ U(lo, hi): (w / (hi − lo)) · [softplus((x − lo)/w) − softplus((x − hi)/w)].
  return clamp01((w / (THETA_PRIOR.hi - THETA_PRIOR.lo)) * (softplus((x - THETA_PRIOR.lo) / w) - softplus((x - THETA_PRIOR.hi) / w)));
}

/** The internal fleet's believed act table of model v (undefined when v runs no internal work). */
function fleetTable(s: GameStateV2, v: ModelVersion): ActTable | undefined {
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
  const fl = internalFleets(s).find((f) => f.v.id === v.id);
  return d && fl ? actTable(s, { deploymentId: d.id, versionId: v.id, usage: fl.usage }, true) : undefined;
}

/** Agent pool share of the installed fleet (hidden compute grows inside it; control.ts controlStep). */
function poolShare(s: GameStateV2): number {
  const installed = computeOnlineOf(s);
  return installed > 0 ? Math.max(0, s.player.computeOnline * (s.player.split.routine + s.player.split.frontier)) / installed : 0;
}

/** Footholds the lab knows of, as they count for v: F and backdoor reach (see the header). */
function knownFootholds(s: GameStateV2, v: ModelVersion): { F: number; reach: number } {
  const lin = lineageOf(s, v);
  const installed = computeOnlineOf(s);
  const pool = poolShare(s);
  let F = 0;
  let miss = 1;
  for (const f of footholdsOf(s) as Foothold[]) {
    if (f.status === 'hidden' || !isActive(f)) continue;
    const suspected = f.status === 'suspected';
    const w = suspected || f.kind === 'exfiltratedCopy' ? 1 : CONTROL.locatedWeight;
    if (f.kind === 'exfiltratedCopy') F += copyF(suspected ? 1 : f.size);
    else if (f.kind === 'backdoor') {
      if (f.lineage === lin) miss *= 1 - w * (suspected ? FOOTHOLD.reachPerSev * typicalSev('BACKDOOR') : f.size);
    } else if (f.kind === 'hiddenCompute') {
      F += suspected ? (FOOTHOLD.hidCompPerSev * typicalSev('HIDCOMP') * pool) / CONTROL.hidCompFull : installed > 0 ? (w * f.size) / installed / CONTROL.hidCompFull : 0;
    } else if (suspected) F += CONTROL.suspectedF;
    else if (f.kind === 'steeredSuccessor' && (f.lineage === lin || f.ref === v.id || f.ref === v.baseId)) {
      F += w * CONTROL.steeredPerPull * Object.values(f.delta ?? {}).reduce((a, d) => a + Math.abs(d ?? 0), 0);
    }
  }
  return { F, reach: Math.min(FOOTHOLD.reachMax, 1 - miss) };
}

/** Unfound footholds the believed table expects of v over UNFOUND_YEARS (full weight, typical size). */
function unfoundFootholds(s: GameStateV2, v: ModelVersion): { F: number; reach: number } {
  const rows = fleetTable(s, v)?.rows ?? [];
  const n = (id: string) => (rows.find((r) => r.id === id)?.unstopped ?? 0) * UNFOUND_YEARS;
  const reach = 1 - Math.pow(1 - FOOTHOLD.reachPerSev * typicalSev('BACKDOOR'), n('BACKDOOR'));
  const F = (n('HIDCOMP') * FOOTHOLD.hidCompPerSev * typicalSev('HIDCOMP') * poolShare(s)) / CONTROL.hidCompFull;
  return { F, reach };
}

/** Believed P(loss) for a model with belief N(m, sd) and exposure multiplier k. */
function pLoss(s: GameStateV2, m: number, sd: number, k: number): number {
  if (sd <= 0) return thetaCdf(s, clamp01(m) * k);
  let p = 0;
  let wSum = 0;
  for (let i = 0; i < GRID; i++) {
    const z = -4 + (8 * i) / (GRID - 1);
    const w = Math.exp(-0.5 * z * z);
    p += w * thetaCdf(s, clamp01(m + sd * z) * k);
    wSum += w;
  }
  return p / wSum;
}

/** Loss-of-control risk of model v (believed only: beliefs, measured levels, believed safeguards, known footholds,
 *  the table's expected unfound ones, the published prior on θ). Never reads s.hidden or true traits. */
export function modelLossRisk(s: GameStateV2, v: ModelVersion, m: LossMods = {}): LossRisk {
  const o = believedInternalOversight(s, v, CONTROL.trait, believedRdShare(s)); // UB-2: the measured AI share of R&D work
  const known = m.noFootholds ? { F: 0, reach: 0 } : knownFootholds(s, v);
  const unfound = m.noFootholds ? { F: 0, reach: 0 } : unfoundFootholds(s, v);
  const reach = Math.min(FOOTHOLD.reachMax, 1 - (1 - known.reach) * (1 - unfound.reach));
  const stop0 = 1 - (1 - o.block * (1 - reach)) * (1 - o.catch * (1 - reach));
  const stopRate = clamp01(stop0 + (m.stopAdd ?? 0));
  const F = known.F + unfound.F;
  const k = (1 - stopRate) * (1 + F);
  const mis = clamp01(misalignmentEstimate(v) + (m.misShift ?? 0));
  const misSd = misalignmentSd(v) * (m.sdMult ?? 1);
  return {
    versionId: v.id, name: v.name,
    p: pLoss(s, mis, misSd, k), lo: pLoss(s, mis - Z90 * misSd, 0, k), hi: pLoss(s, mis + Z90 * misSd, 0, k),
    mis, misSd, stopRate, F, reach, knownF: known.F, unfoundF: unfound.F, unfoundReach: unfound.reach, exposure: mis * k,
  };
}

/** The models the lab runs: its best model, its running internal fleets and its live products' models. */
export function runningModels(s: GameStateV2): ModelVersion[] {
  const out: ModelVersion[] = [];
  const add = (v: ModelVersion | undefined) => { if (v && v.status !== 'retired' && !out.includes(v)) out.push(v); };
  add(bestMeasuredVersion(s)); // UB-2: the best model as measured, never ranked by the true G
  for (const fl of internalFleets(s)) add(fl.v);
  for (const d of s.player.deployments) if (d.status !== 'withdrawn' && d.channel !== 'internal') add(versionById(s, d.versionId));
  return out;
}

/** SR-04 headline: Loss-of-control risk of `model` (a version id), or the lab's (the highest over the models it runs).
 *  Undefined with no model. */
export function lossOfControlRisk(s: GameStateV2, model?: string, m: LossMods = {}): LossRisk | undefined {
  if (model) {
    const v = versionById(s, model);
    return v ? modelLossRisk(s, v, m) : undefined;
  }
  let worst: LossRisk | undefined;
  for (const v of runningModels(s)) {
    const r = modelLossRisk(s, v, m);
    if (!worst || r.p > worst.p) worst = r;
  }
  return worst;
}

/** Expected severity of a per-year row (the incident severity rule's mean, before clamping to 1..5). */
function rowSev(id: string, ableTo: number, af: number): number {
  if (id === 'EXFIL') return 5;
  if (id === 'MISUSE_BIO' || id === 'MISUSE_CYBER') return Math.min(5, MISUSE.floor + MISUSE.span * ableTo);
  const def = DANGER_ACTS[id as TraitId] ?? COVERT_ACTS[id as keyof typeof COVERT_ACTS];
  return def ? Math.max(1, Math.min(5, def.floor + def.span * ableTo * af)) : 1;
}

/** SR-04 companion: Unstopped harm / yr = Σ over every site's believed act table of Unstopped × expected severity
 *  (per-year rows only). `acts`: unweighted unstopped acts / yr. */
export function unstoppedHarmPerYear(s: GameStateV2): { harm: number; acts: number } {
  let harm = 0;
  let acts = 0;
  const visit = (t: ActTable | undefined) => {
    if (!t) return;
    const af = t.site.site.autonomy * t.site.site.afford;
    for (const r of t.rows) {
      if (r.per !== 'year') continue;
      acts += r.unstopped;
      harm += r.unstopped * rowSev(r.id, r.ableTo, af);
    }
  };
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn') continue;
    if (d.channel !== 'internal') { visit(actTable(s, { deploymentId: d.id }, true)); continue; }
    for (const fl of internalFleets(s)) if (fl.v.status !== 'retired') visit(actTable(s, { deploymentId: d.id, versionId: fl.v.id, usage: fl.usage }, true));
  }
  return { harm, acts };
}
