// Footholds: hidden countable AI assets left by uncaught covert acts and escapes (model v3 E8; MODEL-V3 §11.4). Owner: WS2.
//
// State, creation and effects (this file; it imports only data and types, so compute/power.ts and covert.ts can read
// it). Suspicion, location, removal and the player's view are in footholdDetection.ts.
//   kind              created by                                   size                    effect while not removed
//   backdoor          an uncaught BACKDOOR act (grows its lineage's) reach 1 − Π(1 − 0.08·sev) lineage's covert acts: block, catch × (1 − reach)
//   hiddenCompute     an uncaught HIDCOMP act (grows its lineage's)  H100e: 1% of the agent   the lab's usable compute (computeOnline) − size:
//                                                                  pool per severity point  the "unexplained compute use" symptom
//   steeredSuccessor  an uncaught SUCCSTEER act on a run           the extra pull ω         E4/E7: the successor starts with `delta` toward
//                                                                                           its makers (applied by traits.ts pulledTraits)
//   corruptedTool     an uncaught SAFSAB act (a FALSE finding)      the tool's s0            the F49 tool masks instead of detecting
//   exfiltratedCopy   an escape (security.ts → E25, ws4.loose;      copies (grows, E9)       E9 (control.ts): capacity outside
//                     hidden if security missed it, E9)                                     the lab; 'rogue' once grown
// Steering of capability research (STEER) stays a recipe property (covert.ts steered stock → hidden S4), not an asset.
// Status: hidden → suspected (a symptom seen) → detected (located) → removed. The player never sees hidden ones.
import { FOOTHOLD, type CovertActId } from '../../../data/v2/danger';
import type { Foothold, FootholdKind, GameStateV2, ModelVersion, SystemCtx, TraitId, TraitVector } from '../types';

/** Foothold kind each covert act leaves when uncaught (STEER: none, a recipe property). */
export const ACT_FOOTHOLD: Partial<Record<CovertActId, FootholdKind>> = {
  BACKDOOR: 'backdoor', HIDCOMP: 'hiddenCompute', SUCCSTEER: 'steeredSuccessor', SAFSAB: 'corruptedTool',
};
/** Covert act behind each kind (its trait weights set a case's relevance; exfiltration is not a covert act). */
export const FOOTHOLD_ACT: Record<FootholdKind, CovertActId | undefined> = {
  backdoor: 'BACKDOOR', hiddenCompute: 'HIDCOMP', steeredSuccessor: 'SUCCSTEER', corruptedTool: 'SAFSAB', exfiltratedCopy: undefined,
};
export const FOOTHOLD_NAME: Record<FootholdKind, string> = {
  backdoor: 'Backdoor in infrastructure', hiddenCompute: 'Hidden compute reservation', steeredSuccessor: 'Steered successor',
  exfiltratedCopy: 'Exfiltrated copy', corruptedTool: 'Corrupted safety tool',
};

/** Every foothold of the player (engine only: includes hidden ones). */
export const footholdsOf = (s: GameStateV2): Foothold[] => s.player.safety.footholds ?? [];
/** Not removed: its effect still acts. */
export const isActive = (f: Foothold) => f.status !== 'removed';

/** Base lineage of a model (the unit backdoors and hidden compute belong to). */
export function lineageOf(s: GameStateV2, v: Pick<ModelVersion, 'baseId'>): string {
  return s.player.models.bases.find((b) => b.id === v.baseId)?.lineage ?? `L-${v.baseId}`;
}

function newFoothold(s: GameStateV2, kind: FootholdKind, v: ModelVersion, day: number, sev: number, size: number, ref?: string): Foothold {
  const list = (s.player.safety.footholds ??= []);
  const f: Foothold = { id: `FH${list.length + 1}`, kind, versionId: v.id, lineage: lineageOf(s, v), day, acts: 1, severity: sev, size, status: 'hidden', ...(ref ? { ref } : {}) };
  list.push(f);
  return f;
}

/** Internal agent pool (H100e) from the split alone (the save migration; covert.ts passes the fleet's full compute,
 *  spare serving lent to research included). */
const agentPool = (s: GameStateV2) => Math.max(0, s.player.computeOnline * ((s.player.split.routine + s.player.split.frontier)));

/**
 * Book an uncaught covert act as a foothold (called by covert.ts noteCovert). A backdoor or hidden compute act grows
 * its lineage's foothold of that kind while that one is still hidden or suspected (the same access paths, the same
 * reservation), else it starts a new one; successor steering grows the foothold of the same run (`ref`); a corrupted
 * tool is one per FALSE finding (findings.ts sets `ref` and `size` when it creates the tool). `fleetH` = the internal
 * fleet's compute (H100e) that hidden compute hides in. Returns the foothold.
 */
export function footholdFromAct(s: GameStateV2, day: number, act: CovertActId, v: ModelVersion, sev: number, ref?: string, fleetH = agentPool(s)): Foothold | undefined {
  const kind = ACT_FOOTHOLD[act];
  if (!kind) return undefined;
  const lin = lineageOf(s, v);
  const open = (f: Foothold) => f.kind === kind && (f.status === 'hidden' || f.status === 'suspected');
  if (kind === 'backdoor' || kind === 'hiddenCompute') {
    // Hidden compute never exceeds the agent pool it hides in.
    const add = kind === 'backdoor' ? Math.min(FOOTHOLD.reachMax, FOOTHOLD.reachPerSev * sev)
      : Math.min(FOOTHOLD.hidCompPerSev * sev * fleetH, Math.max(0, fleetH - hiddenComputeH(s)));
    const f = footholdsOf(s).find((x) => open(x) && x.lineage === lin);
    if (!f) return newFoothold(s, kind, v, day, sev, add);
    f.acts++;
    f.severity += sev;
    f.size = kind === 'backdoor' ? Math.min(FOOTHOLD.reachMax, 1 - (1 - f.size) * (1 - add)) : f.size + add;
    return f;
  }
  if (kind === 'steeredSuccessor' && ref) {
    const f = footholdsOf(s).find((x) => x.kind === kind && x.ref === ref);
    if (f) {
      f.acts++;
      f.severity += sev;
      return f;
    }
  }
  return newFoothold(s, kind, v, day, sev, 0, ref);
}

/** A completing run's steered successor (safety/traits.ts pulledTraits): the steered-successor footholds of run `runId`
 *  point at `target` (the new version, or the base of a base/continue run) and carry the steered part of its starting
 *  dispositions (`x` − `xE4`, the pull with and without the steering). */
export function linkSteeredSuccessor(s: GameStateV2, runId: string, target: string, x: TraitVector, xE4: TraitVector, traits: readonly TraitId[]): void {
  for (const f of footholdsOf(s)) {
    if (f.kind !== 'steeredSuccessor' || f.ref !== runId) continue;
    f.ref = target;
    const delta: Partial<Record<TraitId, number>> = {};
    for (const t of traits) {
      const d = x[t] - xE4[t];
      if (Math.abs(d) > 1e-9) delta[t] = d;
    }
    f.delta = delta;
  }
}

/** An escape (security.ts): the copy is outside the lab. Noticed (the E25 alert): located at once. Model v3 E9: an
 *  escape security did not notice stays hidden (control.ts escapeNoticed). `mis` = the copy's misalignment index. */
export function footholdFromEscape(s: GameStateV2, day: number, v: ModelVersion, mis?: number, noticed = true): Foothold {
  const f = newFoothold(s, 'exfiltratedCopy', v, day, 5, 1);
  if (mis !== undefined) f.mis = mis;
  if (!noticed) return f;
  f.status = 'detected';
  f.suspectedDay = day;
  f.detectedDay = day;
  f.symptom = 'escape detected by security';
  return f;
}

/** The escaped copy's fate (E25 hunt, endings' rogue clock): captured → removed; went quiet → suspected (nobody knows
 *  where it is any more). */
export function escapeResolved(s: GameStateV2, day: number, how: 'captured' | 'quiet'): void {
  for (const f of footholdsOf(s)) {
    if (f.kind !== 'exfiltratedCopy' || f.status !== 'detected') continue;
    if (how === 'captured') {
      f.status = 'removed';
      f.removedDay = day;
      f.symptom = 'found and shut down';
    } else {
      f.status = 'suspected';
      f.symptom = 'went quiet: location unknown';
    }
  }
}

/** A false-validated tool was exposed (findings.ts revealFalse: cross-check or an independent-family case): its
 *  corrupted-tool foothold is located and removed (the tool is withdrawn). */
export function toolExposed(s: GameStateV2, day: number, techniqueId: string): void {
  for (const f of footholdsOf(s)) {
    if (f.kind !== 'corruptedTool' || f.ref !== techniqueId || f.status === 'removed') continue;
    f.suspectedDay ??= day;
    f.detectedDay ??= day;
    f.status = 'removed';
    f.removedDay = day;
    f.symptom = 'cross-check: the tool masks instead of detecting';
  }
}

/** A caught covert act prompts a sweep for earlier successes of the same kind by the same lineage: each hidden one
 *  becomes suspected with FOOTHOLD.caughtSuspect (hash draw keyed by `key`). */
export function sweepOnCaught(s: GameStateV2, ctx: SystemCtx, act: CovertActId, v: ModelVersion, key: string, draw: (k: string) => number): void {
  const kind = ACT_FOOTHOLD[act];
  if (!kind) return;
  const lin = lineageOf(s, v);
  for (const f of footholdsOf(s)) {
    if (f.kind !== kind || f.status !== 'hidden' || f.lineage !== lin) continue;
    if (draw(`fh:${f.id}:sweep:${key}`) >= FOOTHOLD.caughtSuspect) continue;
    f.status = 'suspected';
    f.suspectedDay = ctx.day;
    f.symptom = `a caught ${FOOTHOLD_NAME[kind].toLowerCase()} attempt prompted a sweep`;
    ctx.log('alert', `Suspected foothold: ${f.symptom} (${FOOTHOLD_NAME[kind]}).`, 3, f.id);
  }
}

// ───────────────────────────── effects ─────────────────────────────

/** H100e reserved by active hidden compute footholds (subtracted from the lab's usable compute, compute/power.ts). */
export function hiddenComputeH(s: GameStateV2): number {
  let h = 0;
  for (const f of footholdsOf(s)) if (f.kind === 'hiddenCompute' && isActive(f)) h += f.size;
  return h;
}

/** Reach of the active backdoors of a lineage: the share of block and catch its covert acts bypass. */
export function backdoorReach(s: GameStateV2, lineage: string): number {
  let miss = 1;
  for (const f of footholdsOf(s)) if (f.kind === 'backdoor' && isActive(f) && f.lineage === lineage) miss *= 1 - f.size;
  return Math.min(FOOTHOLD.reachMax, 1 - miss);
}

/** Safety research engineers tied up by foothold removals in progress (counted with patch projects, responses.ts). */
export function removalFte(s: GameStateV2): number {
  let n = 0;
  for (const f of footholdsOf(s)) if (f.removal && f.removal.until > s.time.day) n += f.removal.fte;
  return n;
}
