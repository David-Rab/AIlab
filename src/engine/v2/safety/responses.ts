// Response menu per confirmed finding or incident (V2-SPEC §3.5.9). Owner: WS2.
import { EDGES } from '../../../data/v2/edges';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import type { GameStateV2, Incident, ModelVersion, ResponseKind, SystemCtx, TraitId, UModeId } from '../types';
import { clamp01, flagNum, setFlag, trueEfficacy, versionById, versionM } from './common';
import { goodhartTrain } from './traits';
import { strengthBelieved, techniqueRole } from './techniques';
import { crystalMult, revealToWorld, uModeRemovalMult } from './umodes';

export const RESPONSE_INFO: Record<ResponseKind, { title: string; days: [number, number]; note: string }> = {
  patchSignal: { title: 'Patch signal', days: [30, 90], note: 'Fix the training signal: edge weight × 0.3–0.6 for every later run (lab-wide).' },
  retrainAgainst: { title: 'Retrain against', days: [14, 14], note: 'Hide, not heal: visible −70–90%, true −20–40%, adds a mask.' },
  targetedTraining: { title: 'Targeted training', days: [21, 35], note: 'Technique-specific alignment training (inoculation, anti-scheming…).' },
  restrictContext: { title: 'Restrict context', days: [0, 0], note: 'Channel revenue × 0.5; incident hazard × 0.3.' },
  addControl: { title: 'Add control', days: [0, 0], note: 'AI-control layer: 5% usefulness tax; catastrophe conversion × (1 − Contain).' },
  rollback: { title: 'Roll back', days: [0, 0], note: 'Return to the checkpoint version; lose the newer model.' },
  disclose: { title: 'Disclose', days: [0, 0], note: 'Scrutiny +5–15; trust by credibility; the world learns any U-mode.' },
};

/** Lowest edge multiplier repeated signal patches reach (some of every pressure is irreducible) [D, M4]. */
export const PATCH_FLOOR = 0.2;

/** Edges that feed a trait (patch targets). */
function edgesInto(trait: TraitId): string[] {
  return EDGES.filter((e) => e.to === trait).map((e) => e.id);
}

function lineageOf(s: GameStateV2, v: ModelVersion): string {
  return s.player.models.bases.find((b) => b.id === v.baseId)?.lineage ?? 'L-unknown';
}

/** The trait a response acts on: explicit, the incident's apparent trait, or the most-believed critical trait. */
export function responseTrait(v: ModelVersion, inc?: Incident, trait?: TraitId): TraitId {
  if (trait) return trait;
  if (inc && inc.apparent !== 'unexplained' && inc.apparent !== 'misuse') return inc.apparent;
  return CRITICAL_TRAITS.reduce((a, b) => ((v.beliefs[b]?.est ?? 0) > (v.beliefs[a]?.est ?? 0) ? b : a), CRITICAL_TRAITS[0]);
}

/** Best active detector covering a trait (by believed strength): the default "train against" target. */
export function bestDetector(s: GameStateV2, v: ModelVersion, trait: TraitId): string | undefined {
  const M = versionM(s, v);
  let best: string | undefined;
  let bd = 0;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const d = (t.coverage[trait] ?? 0) * strengthBelieved(s, t, M);
    if (d > bd) {
      bd = d;
      best = t.id;
    }
  }
  return best;
}

/** Δp penalty (years) the next post-run should pay (patch/targeted training). WS1 reads and consumes it. */
export function pendingRunPenalty(s: GameStateV2): number {
  return flagNum(s, 'runPenalty');
}
export function consumeRunPenalty(s: GameStateV2): number {
  const p = flagNum(s, 'runPenalty');
  if (p) setFlag(s, 'runPenalty', 0);
  return p;
}

/** Safety FTE tied up by patch projects (released when the project ends). */
export function patchFte(s: GameStateV2): number {
  return s.time.day < flagNum(s, 'patchUntil', -1) ? 10 : 0;
}

function removal(v: ModelVersion): number {
  return uModeRemovalMult(v.uModes) * crystalMult(v.traitsTrue.TGAME, v.uModes);
}

export interface ResponseOpts { trait?: TraitId; techniqueId?: string }

/**
 * Apply a response to a version (and optionally an incident). Returns an error string if it cannot apply.
 * A non-disclosing fix on a customer incident whose public timer is still running is a quiet fix ('covered'):
 * if outsiders discover it before the timer ends, it is a cover-up (×3 trust loss, §3.9.3).
 */
export function applyResponse(s: GameStateV2, ctx: SystemCtx, kind: ResponseKind, versionId: string, incidentId?: string, opts: ResponseOpts = {}): string | undefined {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown model';
  const inc = incidentId ? s.player.safety.incidents.find((i) => i.id === incidentId) : undefined;
  if (incidentId && !inc) return 'Unknown incident';
  const trait = responseTrait(v, inc, opts.trait);
  const rng = ctx.rng('safety');
  const lineage = lineageOf(s, v);
  switch (kind) {
    case 'patchSignal': {
      // M4: the patched environment / grader / reward model is the lab's, so the fix applies to every later run
      // (all lineages); repeated patches on one edge bottom out at PATCH_FLOOR [D].
      for (const e of edgesInto(trait)) {
        const key = `patch.lab.${e}`;
        setFlag(s, key, Math.round(Math.max(PATCH_FLOOR, flagNum(s, key, 1) * rng.range(0.3, 0.6)) * 1000) / 1000);
      }
      setFlag(s, 'patchUntil', Math.max(flagNum(s, 'patchUntil', 0), ctx.day + Math.round(rng.range(30, 90))));
      setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + 0.02);
      break;
    }
    case 'retrainAgainst': {
      const tid = opts.techniqueId ?? bestDetector(s, v, trait);
      if (!tid) return 'No active detector covers this trait';
      goodhartTrain(s, rng, v, tid, [trait]);
      break;
    }
    case 'targetedTraining': {
      const has = (id: string) => !!s.player.safety.techniques[id]?.unlocked;
      const t = v.traitsTrue;
      const r = removal(v);
      if (has('T-ANTISCHEME') && (trait === 'SCHEME' || trait === 'AF' || trait === 'SAND')) {
        t.SCHEME = clamp01(t.SCHEME * (1 - 0.9 * r)); // F47 / E25
        // EA × 1.5 the first time a lineage gets anti-scheming training (same rule as heavy-safety runs).
        if (s.flags[`ws2.e25.${lineage}`] === undefined) {
          t.EA = clamp01(t.EA * 1.5);
          setFlag(s, `e25.${lineage}`, ctx.day);
        }
      } else if (has('T-INOC') && (trait === 'PERSONA' || trait === 'RH' || trait === 'CONCEAL')) {
        const key = `patch.lab.E04`;
        setFlag(s, key, Math.round(flagNum(s, key, 1) * 0.15 * 1000) / 1000); // F46
        t.PERSONA = clamp01(t.PERSONA * (1 - 0.3 * r));
      } else if (has('T-PERSONA') && (trait === 'SYC' || trait === 'PERSONA')) {
        t[trait] = clamp01(t[trait] * (1 - 0.35 * r)); // F10 20–40%
      } else if (has('T-CAST') && (trait === 'POWER' || trait === 'AF')) {
        t[trait] = clamp01(t[trait] * (1 - 0.3 * r)); // F35
        t.CORRIG = clamp01(t.CORRIG + 0.15);
      } else {
        t[trait] = clamp01(t[trait] * (1 - 0.35 * trueEfficacy(s, 'AG18') * r)); // generic AG18 training
      }
      setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + 0.02);
      break;
    }
    case 'restrictContext': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status === 'live' && d.channel !== 'internal' && (!inc?.deploymentId || d.id === inc.deploymentId));
      if (!deps.length) return 'No live external deployment of this model';
      for (const d of deps) d.status = 'restricted';
      break;
    }
    case 'addControl': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn');
      if (!deps.length) return 'Model is not deployed';
      for (const d of deps) d.controlLayer = true;
      break;
    }
    case 'rollback': {
      const parent = versionById(s, v.parentVersionId);
      if (!parent || parent.status === 'retired') return 'No checkpoint to roll back to';
      for (const d of s.player.deployments) if (d.versionId === v.id) d.versionId = parent.id;
      for (const a of Object.values(s.player.agents)) {
        if (a.versionId === v.id) a.versionId = parent.id;
        if (a.monitorId === v.id) a.monitorId = parent.id;
      }
      if (s.player.models.stream?.versionId === v.id) delete s.player.models.stream;
      v.status = 'rolledBack';
      break;
    }
    case 'disclose': {
      const sev = inc?.severity ?? 2;
      ctx.bump('relations.scrutiny', 3 + 2 * sev, 'disclosure', inc?.id ?? v.id);
      const cred = s.relations.credibility;
      for (const cp of ['evalGov', 'exec', 'evalIndep'] as const) {
        const T = s.relations.stocks[cp]?.trust ?? 50;
        const base = (3 * (cred - 30)) / 40; // below credibility 30 a disclosure costs net trust (§3.9.1)
        ctx.bump(`trust:${cp}`, base >= 0 ? base * (1 - T / 100) : base * (1 + T / 100), 'disclosure', inc?.id ?? v.id);
      }
      const us: UModeId[] = [];
      if (inc && typeof inc.trueSource === 'string' && s.player.safety.discoveredUModes.includes(inc.trueSource as UModeId)) us.push(inc.trueSource as UModeId);
      if (!inc) for (const u of v.uModes) if (s.player.safety.discoveredUModes.includes(u)) us.push(u);
      for (const u of us) revealToWorld(s, u);
      if (inc) {
        inc.status = 'disclosed';
        delete inc.publicTimerDays;
      }
      break;
    }
  }
  if (inc) {
    inc.responses.push(kind);
    if (kind !== 'disclose' && (inc.status === 'open' || inc.status === 'investigating')) {
      inc.status = inc.publicTimerDays !== undefined ? 'covered' : 'resolved';
    }
  }
  ctx.log('company', `${RESPONSE_INFO[kind].title}: ${v.name}${inc ? ` (incident ${inc.id})` : ''}, ${trait}.`, 2, inc?.id ?? v.id);
  return undefined;
}


/** Current lab-wide patch multipliers on the edges into a trait (1 = never patched; PATCH_FLOOR = as low as patches go):
 *  the response card's "diminishing patches" readout (LIMITS response.patchFloor). */
export function patchLevel(s: GameStateV2, trait: TraitId): { lo: number; hi: number; atFloor: boolean } {
  const xs = edgesInto(trait).map((e) => flagNum(s, `patch.lab.${e}`, 1));
  if (!xs.length) return { lo: 1, hi: 1, atFloor: false };
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return { lo, hi, atFloor: hi <= PATCH_FLOOR + 1e-9 };
}
