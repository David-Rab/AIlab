// Response menu per confirmed finding or incident (V2-SPEC §3.5.9). Owner: WS2.
import { EDGES } from '../../../data/v2/edges';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import type { GameStateV2, Incident, ModelVersion, ResponseKind, SystemCtx, TraitId, UModeId } from '../types';
import { clamp01, flagNum, setFlag, trueEfficacy, versionById } from './common';
import { measuredOom } from './oversight';
import { ANTISCHEME_EA_MULT, ANTISCHEME_REMOVAL, goodhartTrain } from './traits';
import { strengthBelieved, techniqueRole } from './techniques';
import { crystalMult, revealToWorld, uModeRemovalMult } from './umodes';
import { removalFte } from './footholds';
import { removeFoothold } from './footholdDetection';
import { AGENT_USES } from '../../../data/v2/agents';
import { agentVersion, syncInternalControl } from '../departments/agents';

export const RESPONSE_INFO: Record<ResponseKind, { title: string; days: [number, number]; note: string }> = {
  patchSignal: { title: 'Patch signal', days: [30, 90], note: 'Fix the training signal: edge weight × 0.3–0.6 for every later run (lab-wide).' },
  retrainAgainst: { title: 'Retrain against', days: [14, 14], note: 'Hide, not heal: visible −70–90%, true −20–40%, adds a mask.' },
  targetedTraining: { title: 'Targeted training', days: [21, 35], note: 'Technique-specific alignment training (inoculation, anti-scheming…).' },
  restrictContext: { title: 'Restrict context', days: [0, 0], note: 'Restricted products: usage, revenue, misuse reach and incident opportunity × 0.3.' },
  addControl: { title: 'Add control', days: [0, 0], note: 'AI-control layer: 5% usefulness tax; catastrophe conversion × (1 − Contain).' },
  removeControl: { title: 'Remove control', days: [0, 0], note: 'Turn the AI-control layer off: the usefulness tax ends; containment and deferral end with it (model v3 F6).' },
  rollback: { title: 'Roll back', days: [0, 0], note: 'Return to the checkpoint version; lose the newer model.' },
  disclose: { title: 'Disclose', days: [0, 0], note: 'Scrutiny +5–15; trust by credibility; the world learns any U-mode.' },
  removeFoothold: { title: 'Remove foothold', days: [14, 30], note: 'A located foothold: safety engineers, agents off for the downtime; its effect ends (model v3 E8).' },
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

/** Best active detector covering a trait (by believed strength): the default "train against" target. F6e: at the
 *  measured capability (was the true OOM), so the Respond preview names the detector apply picks. */
export function bestDetector(s: GameStateV2, v: ModelVersion, trait: TraitId): string | undefined {
  const X = measuredOom(s, v);
  let best: string | undefined;
  let bd = 0;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const d = (t.coverage[trait] ?? 0) * strengthBelieved(s, t, X);
    if (d > bd) {
      bd = d;
      best = t.id;
    }
  }
  return best;
}

/** G penalty (OOM) the next post-run should pay (patch/targeted training). WS1 reads and consumes it. */
export function pendingRunPenalty(s: GameStateV2): number {
  return flagNum(s, 'runPenalty');
}
export function consumeRunPenalty(s: GameStateV2): number {
  const p = flagNum(s, 'runPenalty');
  if (p) setFlag(s, 'runPenalty', 0);
  return p;
}

/** Safety FTE tied up by patch projects and foothold removals (released when they end). */
export function patchFte(s: GameStateV2): number {
  return (s.time.day < flagNum(s, 'patchUntil', -1) ? PATCH_FTE : 0) + removalFte(s);
}

function removal(v: ModelVersion): number {
  return uModeRemovalMult(v.uModes) * crystalMult(v.traitsTrue.TGAME, v.uModes);
}

// ───────────── F6e: the numbers each response applies, shared by applyResponse and the Respond preview ─────────────

/** Patch signal: each edge into the trait × PATCH_MULT (drawn) lab-wide, floor PATCH_FLOOR; PATCH_FTE safety research
 *  engineers for PATCH_DAYS (drawn); the next post-training run pays RUN_PENALTY_OOM OOM of G. */
export const PATCH_MULT: [number, number] = [0.3, 0.6];
export const PATCH_DAYS: [number, number] = [30, 90];
export const PATCH_FTE = 10;
/** OOM of G the next post-training run loses after a patch or a targeted training. Was 0.02 progress-years. */
export const RUN_PENALTY_OOM = 0.024;

/** What targeted training does with the lab's unlocked techniques: the share `cut` of each trait removed (× the U-mode
 *  removal multiplier when applied), traits raised by `add`, E25's EA × ANTISCHEME_EA_MULT, inoculation's E04 patch.
 *  `eff` is AG18's efficacy: true in the engine, believed in the preview. */
export interface TargetedPlan { technique?: string; cut: Partial<Record<TraitId, number>>; add: Partial<Record<TraitId, number>>; eaMult: boolean; patchE04?: number }
export function targetedPlan(s: GameStateV2, v: ModelVersion, trait: TraitId, eff: number): TargetedPlan {
  const has = (id: string) => !!s.player.safety.techniques[id]?.unlocked;
  if (has('T-ANTISCHEME') && (trait === 'SCHEME' || trait === 'AF' || trait === 'SAND')) {
    // EA × ANTISCHEME_EA_MULT the first time a lineage gets anti-scheming training (same rule as heavy-safety runs).
    return { technique: 'T-ANTISCHEME', cut: { SCHEME: ANTISCHEME_REMOVAL }, add: {}, eaMult: s.flags[`ws2.e25.${lineageOf(s, v)}`] === undefined }; // F47 / E25
  }
  if (has('T-INOC') && (trait === 'PERSONA' || trait === 'RH' || trait === 'CONCEAL')) return { technique: 'T-INOC', cut: { PERSONA: 0.3 }, add: {}, eaMult: false, patchE04: 0.15 }; // F46
  if (has('T-PERSONA') && (trait === 'SYC' || trait === 'PERSONA')) return { technique: 'T-PERSONA', cut: { [trait]: 0.35 }, add: {}, eaMult: false }; // F10 20–40%
  if (has('T-CAST') && (trait === 'POWER' || trait === 'AF')) return { technique: 'T-CAST', cut: { [trait]: 0.3 }, add: { CORRIG: 0.15 }, eaMult: false }; // F35
  return { cut: { [trait]: 0.35 * eff }, add: {}, eaMult: false }; // generic AG18 training
}

/** The live external deployments Restrict context restricts (the incident's own deployment when it names one). */
export function restrictTargets(s: GameStateV2, v: ModelVersion, inc?: Incident) {
  return s.player.deployments.filter((d) => d.versionId === v.id && d.status === 'live' && d.channel !== 'internal' && (!inc?.deploymentId || d.id === inc.deploymentId));
}

/** Disclosure's trust change per counterparty at today's credibility (below 30 it costs trust, §3.9.1), after the
 *  counterparty's trust level (gains shrink near 100, losses grow). */
export const DISCLOSE_CPS = ['evalGov', 'exec', 'evalIndep'] as const;
export function discloseTrust(s: GameStateV2, cp: (typeof DISCLOSE_CPS)[number]): number {
  const T = s.relations.stocks[cp]?.trust ?? 50;
  const base = (3 * (s.relations.credibility - 30)) / 40;
  return base >= 0 ? base * (1 - T / 100) : base * (1 + T / 100);
}
export const discloseScrutiny = (inc?: Incident) => 3 + 2 * (inc?.severity ?? 2);

export interface ResponseOpts { trait?: TraitId; techniqueId?: string; /** removeFoothold: the located foothold. */ footholdId?: string }

/**
 * Apply a response to a version (and optionally an incident). Returns an error string if it cannot apply.
 * A non-disclosing fix on a customer incident whose public timer is still running is a quiet fix ('covered'):
 * if outsiders discover it before the timer ends, it is a cover-up (×3 trust loss, §3.9.3).
 */
export function applyResponse(s: GameStateV2, ctx: SystemCtx, kind: ResponseKind, versionId: string, incidentId?: string, opts: ResponseOpts = {}): string | undefined {
  if (kind === 'removeFoothold') return removeFoothold(s, ctx, opts.footholdId ?? '');
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
        setFlag(s, key, Math.round(Math.max(PATCH_FLOOR, flagNum(s, key, 1) * rng.range(PATCH_MULT[0], PATCH_MULT[1])) * 1000) / 1000);
      }
      setFlag(s, 'patchUntil', Math.max(flagNum(s, 'patchUntil', 0), ctx.day + Math.round(rng.range(PATCH_DAYS[0], PATCH_DAYS[1]))));
      setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + RUN_PENALTY_OOM);
      break;
    }
    case 'retrainAgainst': {
      const tid = opts.techniqueId ?? bestDetector(s, v, trait);
      if (!tid) return 'No active detector covers this trait';
      goodhartTrain(s, rng, v, tid, [trait]);
      break;
    }
    case 'targetedTraining': {
      // F6e: the plan (targetedPlan) is the one the preview shows, with AG18's true efficacy here.
      const t = v.traitsTrue;
      const r = removal(v);
      const plan = targetedPlan(s, v, trait, trueEfficacy(s, 'AG18'));
      for (const [k, c] of Object.entries(plan.cut) as [TraitId, number][]) t[k] = clamp01(t[k] * (1 - c * r));
      if (plan.eaMult) {
        t.EA = clamp01(t.EA * ANTISCHEME_EA_MULT);
        setFlag(s, `e25.${lineage}`, ctx.day);
      }
      if (plan.patchE04 !== undefined) {
        const key = `patch.lab.E04`;
        setFlag(s, key, Math.round(flagNum(s, key, 1) * plan.patchE04 * 1000) / 1000);
      }
      for (const [k, a] of Object.entries(plan.add) as [TraitId, number][]) t[k] = clamp01(t[k] + a);
      setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + RUN_PENALTY_OOM);
      break;
    }
    case 'restrictContext': {
      const deps = restrictTargets(s, v, inc);
      if (!deps.length) return 'No live external deployment of this model';
      for (const d of deps) d.status = 'restricted';
      break;
    }
    case 'addControl': {
      // RD-A06: products on the model and every agent package running it (the control layer is per package).
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn');
      const uses = AGENT_USES.filter((u) => agentVersion(s, u)?.id === v.id);
      if (!deps.length && !uses.length) return 'Model is not deployed';
      for (const d of deps) d.controlLayer = true;
      for (const u of uses) s.player.agents[u].control = true;
      syncInternalControl(s);
      break;
    }
    case 'removeControl': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn' && d.controlLayer);
      const uses = AGENT_USES.filter((u) => s.player.agents[u].control && agentVersion(s, u)?.id === v.id);
      if (!deps.length && !uses.length) return 'No control layer on this model';
      for (const d of deps) d.controlLayer = false;
      for (const u of uses) s.player.agents[u].control = false;
      syncInternalControl(s);
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
      ctx.bump('relations.scrutiny', discloseScrutiny(inc), 'disclosure', inc?.id ?? v.id);
      for (const cp of DISCLOSE_CPS) ctx.bump(`trust:${cp}`, discloseTrust(s, cp), 'disclosure', inc?.id ?? v.id);
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
export function patchLevel(s: GameStateV2, trait: TraitId): { lo: number; hi: number; atFloor: boolean; n: number } {
  const xs = edgesInto(trait).map((e) => flagNum(s, `patch.lab.${e}`, 1));
  if (!xs.length) return { lo: 1, hi: 1, atFloor: false, n: 0 };
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return { lo, hi, atFloor: hi <= PATCH_FLOOR + 1e-9, n: xs.length };
}
