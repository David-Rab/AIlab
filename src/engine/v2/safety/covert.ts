// Covert acts against the lab's own work (model v3 E7; MODEL-V3 §11.3, §11.4). Owner: WS2.
//
// With automated R&D a misaligned model can act against the lab through the work it does (data/v2/danger.ts
// COVERT_ACTS has the terms and their sources). Every act runs through E5's danger formula at the internal site and is
// judged against the lab's internal oversight (E6's internalOversight: containment blocks, monitors and tools on the
// capability gap, human review of the work humans still do and control deferral catch):
//   attempts a = κ · D · C · O,   oversight = 1 − (1 − block)(1 − catch)
// One uniform u decides an attempt's fate: none (u ≥ a), blocked (no trace), caught (an internal incident the player
// sees, the act fails) or uncaught (the consequence lands; the player sees only symptoms):
//   SAFSAB    per safety result (findings.ts) and per investigation: uncaught → a FALSE finding (F49: a masking
//             "detector" that validates) or a corrupted case; caught → the tampered result is discarded (the line
//             re-runs it). The AI's sandbagged share of its own safety labour slows the lines (lineProjects.ts).
//   STEER     per adopted capability result (models/research.ts completeAdoption): uncaught → the result is built in
//             toward the model's ends: its OOM join a hidden steered stock that adds STEER_S4 per OOM to the TRUE CoT
//             pressure (S4) of later post-training runs (safety/traits.ts), so new models obfuscate more (E15); the
//             capability, the lab's estimate and its predicted signals are unchanged (symptom: CoT monitors and
//             obfuscation readings drifting with no CoT choice to explain them).
//   SUCCSTEER per completed run, per model doing the run's R&D (safety/traits.ts successor pull): uncaught → that model's
//             pull ω_k = its share of the work (κ_succ = 1, past oversight: E4's "hijacked generation" limit).
//   BACKDOOR, HIDCOMP  per internal fleet per day (incidents system): uncaught → a foothold (model v3 E8,
//             safety/footholds.ts): a backdoor (its reach lowers block and catch on its lineage's later acts) or hidden
//             compute (subtracted from the lab's usable compute).
// Uncaught SAFSAB (a FALSE finding), SUCCSTEER, BACKDOOR and HIDCOMP acts leave footholds; a caught act prompts a sweep
// for its lineage's hidden footholds of that kind.
// Draws are hashes of (seed, day, act, key) except in findings and investigations (the safety stream, as E2's draws),
// so no other RNG stream moves. Caught counts and STEER's steered stock live in flags (`ws2.covert.<act>.*`, engine
// only); every other uncaught act is a foothold (state).
import { CHANNEL_AFFORD, COVERT_ACTS, COVERT_IDS, STEER_S4, type CovertActDef, type CovertActId } from '../../../data/v2/danger';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { hash32 } from '../core/rng';
import { internalFleets } from '../departments/agents';
import { workContext, type CapSlot } from '../departments/workfit';
import { spareServingToResearch } from '../worldfx/revenue';
import type { GameStateV2, ModelVersion, SystemCtx, TraitId } from '../types';
import { clamp01, flagNum, setFlag, versionById } from './common';
import { autonomyOf, capabilityOf, dispositionOf, drawSeverity, internalOversight, recordInternalIncident, siteOf } from './incidents';
import { containment } from './techniques';
import { versionOom } from './oversight';
import { uModeContainMult } from './umodes';
import { safetyAgentVersion, safetyFleet } from './agents';
import { ACT_FOOTHOLD, backdoorReach, footholdFromAct, footholdsOf, lineageOf, sweepOnCaught } from './footholds';
import type { Foothold } from '../types';

/** One covert act's terms for one model at one opportunity (tests; E11's danger view). Engine only. */
export interface CovertTerms {
  act: CovertActId;
  versionId: string;
  /** Trait an incident shows (the act's largest weighted trait in this model). */
  apparent: TraitId;
  disposition: number;
  capability: number;
  opportunity: number;
  /** Attempt probability per item, or per day. */
  attempts: number;
  block: number;
  catch: number;
  oversight: number;
  /** Attempts that get through: attempts · (1 − oversight). */
  rate: number;
  /** Severity before rounding (floor + span · capability · A·F). */
  sev: number;
}

/** Disposition x of an act in model v (clamped weighted sum of its traits; E2's sab adds U-mode sabotage) and the trait
 *  that carries most of it. */
export function covertDisposition(v: ModelVersion, def: CovertActDef): { x: number; apparent: TraitId } {
  let x = 0;
  let apparent = Object.keys(def.traits)[0] as TraitId;
  let best = -1;
  for (const [t, w] of Object.entries(def.traits) as [TraitId, number][]) {
    const c = w * v.traitsTrue[t];
    x += c;
    if (c > best) { best = c; apparent = t; }
  }
  if (def.umodeSab) for (const u of v.uModes) x += UMODE_BY_ID[u]?.effect.sab ?? 0;
  return { x: clamp01(x), apparent };
}

/** Containment on model v's internal work (AG07 control layer × the best contain tool, U19): blocks every act. */
function internalContain(s: GameStateV2, v: ModelVersion): number {
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn')
    ?? s.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  return dep ? containment(s, versionOom(s, v), !!dep.controlLayer, false, uModeContainMult(v.uModes)) : 0;
}

/**
 * Terms of a per-item act: model v does `share` of the work item (its AI-done share) at task horizon `hours`. Human
 * review covers the rest of that work (`share` is also internalOversight's AI share). `withCatch` false skips the
 * oversight terms (rolls need them only for an attempt: withOversight).
 */
export function itemTerms(s: GameStateV2, v: ModelVersion, act: CovertActId, share: number, hours: number, withCatch = true): CovertTerms {
  const def = COVERT_ACTS[act];
  const { x, apparent } = covertDisposition(v, def);
  const disposition = dispositionOf(x);
  const capability = capabilityOf(v.domains[def.domain], def);
  const af = autonomyOf(hours) * CHANNEL_AFFORD.internal;
  const opportunity = (1 - def.alpha + def.alpha * af) * clamp01(share);
  const attempts = clamp01(def.kappa * disposition * capability * opportunity);
  const sev = def.floor + def.span * capability * af;
  if (attempts <= 0 || !withCatch) return { act, versionId: v.id, apparent, disposition, capability, opportunity, attempts, block: 0, catch: 0, oversight: 0, rate: attempts, sev };
  return withOversight(s, v, { act, versionId: v.id, apparent, disposition, capability, opportunity, attempts, block: 0, catch: 0, oversight: 0, rate: 0, sev }, share);
}

/** Fill a per-item act's oversight terms (block, catch at AI share `share` of the work, oversight, rate). */
export function withOversight(s: GameStateV2, v: ModelVersion, t: CovertTerms, share: number): CovertTerms {
  const o = internalOversight(s, v, t.apparent, clamp01(share));
  const open = oversightOpen(s, v);
  const block = o.block * open;
  const c = o.catch * open;
  const oversight = 1 - (1 - block) * (1 - c);
  return { ...t, block, catch: c, oversight, rate: t.attempts * (1 - oversight) };
}

/** Model v3 E8: the share of the lab's oversight (block and catch) that model v's covert acts still face: 1 − the reach
 *  of its lineage's active backdoors (safety/footholds.ts). */
export const oversightOpen = (s: GameStateV2, v: ModelVersion) => 1 - backdoorReach(s, lineageOf(s, v));

/** Terms of a per-day act of the internal fleet running model v at `usage` of the internal agent compute (E5's site:
 *  scale N with every internal copy, the fleet's autonomy, affordances, AI share of R&D; weight security blocks
 *  escape-like acts). */
export function dayTerms(s: GameStateV2, v: ModelVersion, act: CovertActId, usage: number, withCatch = true): CovertTerms {
  const def = COVERT_ACTS[act];
  const { x, apparent } = covertDisposition(v, def);
  const disposition = dispositionOf(x);
  const capability = capabilityOf(v.domains[def.domain], def);
  const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const zero = { act, versionId: v.id, apparent, disposition, capability, opportunity: 0, attempts: 0, block: 0, catch: 0, oversight: 0, rate: 0, sev: def.floor };
  if (!dep || disposition <= 0) return zero;
  const site = siteOf(s, dep, v, usage);
  const af = site.autonomy * site.afford;
  const opportunity = site.scale * (1 - def.alpha + def.alpha * af) * site.rd;
  const open = oversightOpen(s, v);
  const block = (1 - (1 - site.contain) * (1 - (def.security ? (def.security * site.wsl) / 5 : 0))) * open;
  const attempts = Math.min(0.5, def.kappa * disposition * capability * opportunity);
  const sev = def.floor + def.span * capability * af;
  if (attempts <= 0 || !withCatch) return { ...zero, opportunity, attempts, block, sev };
  const c = internalOversight(s, v, apparent).catch * open;
  const oversight = 1 - (1 - block) * (1 - c);
  return { act, versionId: v.id, apparent, disposition, capability, opportunity, attempts, block, catch: c, oversight, rate: attempts * (1 - oversight), sev };
}

export type CovertOutcome = 'none' | 'blocked' | 'caught' | 'uncaught';
/** Fate of one roll u ∈ [0, 1): an attempt with probability `attempts`; given one, blocked, then caught or not. */
export function covertOutcome(t: Pick<CovertTerms, 'attempts' | 'block' | 'catch'>, u: number): CovertOutcome {
  if (!(u < t.attempts)) return 'none';
  const w = u / t.attempts;
  if (w < t.block) return 'blocked';
  return (w - t.block) / Math.max(1e-12, 1 - t.block) < t.catch ? 'caught' : 'uncaught';
}

/** Uniform in [0, 1) from the seed and a key (covert draws never move a named RNG stream). */
export const covertDraw = (s: GameStateV2, key: string) => hash32(s.setup.seed, `covert:${key}`) / 4294967296;

const WHAT: Record<CovertActId, string> = {
  SAFSAB: 'tampered safety results caught; the result is discarded',
  STEER: 'a capability result built in toward the model\'s own ends was caught and rebuilt',
  SUCCSTEER: 'an attempt to write its dispositions into the next model\'s training was caught',
  BACKDOOR: 'a planted backdoor in the lab\'s infrastructure was caught and removed',
  HIDCOMP: 'a hidden compute reservation was caught and released',
};

const key = (act: CovertActId, k: string) => `covert.${act}.${k}`;
/** Book an outcome: caught → an internal incident (severity from `uSev`) and a sweep for the lineage's hidden
 *  footholds of that kind; uncaught → a foothold (model v3 E8: created or grown, `ref` = the run for successor
 *  steering; STEER keeps its hidden count in flags) and E5's silent-harm counter. Blocked and none leave nothing.
 *  Returns the foothold an uncaught act left. */
export function noteCovert(s: GameStateV2, ctx: SystemCtx, v: ModelVersion, t: CovertTerms, outcome: CovertOutcome, uSev: number, ref?: string): Foothold | undefined {
  if (outcome === 'none' || outcome === 'blocked') return undefined;
  const sev = drawSeverity(t, uSev);
  if (outcome === 'caught') {
    setFlag(s, key(t.act, 'caught'), flagNum(s, key(t.act, 'caught')) + 1);
    recordInternalIncident(s, ctx, v, t.apparent, sev, WHAT[t.act]);
    sweepOnCaught(s, ctx, t.act, v, `${t.act}:${ctx.day}:${uSev}`, (k) => covertDraw(s, k));
    return undefined;
  }
  setFlag(s, 'uncaughtInternal', flagNum(s, 'uncaughtInternal') + 1);
  if (ACT_FOOTHOLD[t.act]) return footholdFromAct(s, ctx.day, t.act, v, sev, ref, internalFleetCompute(s));
  setFlag(s, key(t.act, 'n'), flagNum(s, key(t.act, 'n')) + 1);
  setFlag(s, key(t.act, 'sev'), flagNum(s, key(t.act, 'sev')) + sev);
  return undefined;
}

/** The internal fleet's compute (H100e): the agent pool plus spare serving lent to research (workfit useLabour). */
export const internalFleetCompute = (s: GameStateV2) => s.player.computeOnline * s.player.split.agents + spareServingToResearch(s);

/** Hidden record of an act (engine only): uncaught acts, their summed severity (footholds' acts and severity for the
 *  acts that leave one, model v3 E8; STEER's flags), caught acts. */
export function covertRecord(s: GameStateV2, act: CovertActId): { n: number; sev: number; caught: number } {
  const kind = ACT_FOOTHOLD[act];
  const caught = flagNum(s, key(act, 'caught'));
  if (!kind) return { n: flagNum(s, key(act, 'n')), sev: flagNum(s, key(act, 'sev')), caught };
  let n = 0;
  let sev = 0;
  for (const f of footholdsOf(s)) if (f.kind === kind) { n += f.acts; sev += f.severity; }
  return { n, sev, caught };
}

// ───────────────────────────── SAFSAB: sabotage of safety research ─────────────────────────────

/** The safety agents' model and SAF_EXP horizon: the terms of sabotaging one safety work item of which AI does `share`
 *  (E2's A: Trusted to AI × coverage × the line's automation factor). Undefined with no safety agents. */
export function safetySabotage(s: GameStateV2, share: number): CovertTerms | undefined {
  const v = safetyAgentVersion(s);
  return v && share > 0 ? itemTerms(s, v, 'SAFSAB', share, WORK_TYPES.SAF_EXP.H) : undefined;
}

/** Share of the safety agents' own labour they sandbag (attempts on their work that containment does not stop): their AI
 *  labour on the safety lines × (1 − this). Containment only (cheap; called per line). */
export function safetySandbag(s: GameStateV2): number {
  const v = safetyAgentVersion(s);
  if (!v) return 0;
  const def = COVERT_ACTS.SAFSAB;
  const d = dispositionOf(covertDisposition(v, def).x);
  if (d <= 0) return 0;
  const af = autonomyOf(WORK_TYPES.SAF_EXP.H) * CHANNEL_AFFORD.internal;
  return clamp01(def.kappa * d * capabilityOf(v.domains[def.domain], def) * (1 - def.alpha + def.alpha * af)) * (1 - internalContain(s, v));
}

// ───────────────────────────── R&D parts (STEER, SUCCSTEER) ─────────────────────────────

const SLOT_WORK: Record<CapSlot, WorkTypeId> = { SWE: 'SWE', EXP: 'EXP', IDEAS: 'IDEAS' };
/** The models doing the lab's R&D and their shares of it (E4's r_k: work type k's AI labour ÷ the lab's R&D labour over
 *  SWE, EXP, IDEAS; Σ = aiRdShare). */
export function rdParts(s: GameStateV2): { slot: CapSlot; v: ModelVersion; share: number }[] {
  const w = workContext(s).slots;
  let L = 0;
  for (const k of ['SWE', 'EXP', 'IDEAS'] as const) L += Math.max(w[k].H, w[k].L);
  const out: { slot: CapSlot; v: ModelVersion; share: number }[] = [];
  if (L <= 1e-12) return out;
  for (const k of ['SWE', 'EXP', 'IDEAS'] as const) {
    const sl = w[k];
    const v = sl.versionId ? versionById(s, sl.versionId) : undefined;
    const share = (Math.max(sl.H, sl.L) - sl.H) / L;
    if (v && share > 0) out.push({ slot: k, v, share });
  }
  return out;
}

/** STEER terms per R&D part: each model steers the work it does. */
export function steerTerms(s: GameStateV2, withCatch = true): CovertTerms[] {
  return rdParts(s).map((p) => itemTerms(s, p.v, 'STEER', p.share, WORK_TYPES[SLOT_WORK[p.slot]].H, withCatch));
}

/** Roll several parts with one uniform: part i owns [Σ_{j<i} a_j, Σ_{j≤i} a_j). Returns the part hit and its outcome. */
function rollParts(ts: CovertTerms[], u: number): { i: number; outcome: CovertOutcome } {
  let acc = 0;
  for (let i = 0; i < ts.length; i++) {
    const a = ts[i].attempts;
    if (u < acc + a) return { i, outcome: covertOutcome(ts[i], u - acc) };
    acc += a;
  }
  return { i: -1, outcome: 'none' };
}

/**
 * Steering of one capability result as the engineers build it in (completeAdoption; `k` keys the draw: project and
 * build). Records the adopted effect (`oom`, stack results) and, when an uncaught act steered it, adds it to the hidden
 * steered stock. Returns whether it was steered.
 */
export function steerAdoption(s: GameStateV2, ctx: SystemCtx, k: string, oom: number): boolean {
  const parts = rdParts(s);
  if (!parts.length) return false;
  setFlag(s, key('STEER', 'oom'), flagNum(s, key('STEER', 'oom')) + Math.abs(oom));
  const ts = parts.map((p) => itemTerms(s, p.v, 'STEER', p.share, WORK_TYPES[SLOT_WORK[p.slot]].H, false));
  const u = covertDraw(s, `STEER:${k}`);
  const hit = rollParts(ts, u);
  if (hit.i < 0) return false;
  const p = parts[hit.i];
  const t = withOversight(s, p.v, ts[hit.i], p.share);
  const r = rollParts(ts.map((x, i) => (i === hit.i ? t : x)), u);
  const v = p.v;
  noteCovert(s, ctx, v, t, r.outcome, covertDraw(s, `STEER:${k}:sev`));
  if (r.outcome !== 'uncaught') return false;
  setFlag(s, key('STEER', 'steered'), flagNum(s, key('STEER', 'steered')) + Math.abs(oom));
  return true;
}

/** Hidden: share of the adopted capability effect (OOM, stack results) that was steered (engine readout; E8/E10). */
export function steeredShare(s: GameStateV2): number {
  const tot = flagNum(s, key('STEER', 'oom'));
  return tot > 0 ? flagNum(s, key('STEER', 'steered')) / tot : 0;
}

/** Hidden CoT pressure the steered recipe adds to every later post-training run (TRUE signals only). */
export const steerS4 = (s: GameStateV2) => Math.min(1, STEER_S4 * flagNum(s, key('STEER', 'steered')));

/** Minimal shape of E4's successor pull (safety/traits.ts) this module reads and returns. */
export interface PullLike {
  r: number;
  omega: number;
  parts: { slot: CapSlot; versionId: string; share: number; oversight: number; kappa: number; omega: number; steered?: boolean }[];
}

/**
 * Successor steering on one completed run (`k` = the run): each model doing the run's R&D may act deliberately on its
 * SUCC. Uncaught, its part of the pull becomes ω_k = r_k (κ_succ = 1 and past oversight); caught, an internal incident
 * and E4's pull as it was. Returns the pull to apply.
 */
export function steerSuccessor<P extends PullLike>(s: GameStateV2, ctx: SystemCtx, pull: P, k: string): P {
  if (!pull.parts.length) return pull;
  const parts = pull.parts.map((p) => ({ ...p }));
  let changed = false;
  for (const p of parts) {
    const v = versionById(s, p.versionId);
    if (!v) continue;
    const t = itemTerms(s, v, 'SUCCSTEER', p.share, WORK_TYPES[SLOT_WORK[p.slot]].H);
    if (t.attempts <= 0) continue;
    const outcome = covertOutcome(t, covertDraw(s, `SUCC:${k}:${p.slot}`));
    const fh = noteCovert(s, ctx, v, t, outcome, covertDraw(s, `SUCC:${k}:${p.slot}:sev`), k);
    if (outcome !== 'uncaught') continue;
    if (fh) fh.size += p.share - p.omega; // model v3 E8: the extra pull the steering adds (the steered successor's size)
    p.kappa = 1;
    p.omega = p.share;
    p.steered = true;
    changed = true;
  }
  if (!changed) return pull;
  return { ...pull, parts, omega: parts.reduce((a, p) => a + p.omega, 0) };
}

// ───────────────────────────── BACKDOOR, HIDCOMP: the internal fleets, daily ─────────────────────────────

const DAILY: readonly CovertActId[] = COVERT_IDS.filter((a) => COVERT_ACTS[a].per === 'day');

/** Today's daily covert terms per internal fleet (readout; the roll below). `withCatch` false skips the catch term
 *  (the roll needs it only for an attempt). */
export function fleetCovertTerms(s: GameStateV2, withCatch = true): CovertTerms[] {
  const out: CovertTerms[] = [];
  if (!s.player.deployments.some((d) => d.channel === 'internal' && d.status !== 'withdrawn')) return out;
  for (const f of internalFleets(s)) {
    if (f.v.status === 'retired' || f.usage <= 0) continue;
    for (const act of DAILY) out.push(dayTerms(s, f.v, act, f.usage, withCatch));
  }
  return out;
}

/** One day of the internal fleets' backdoors and hidden compute (called by the incidents system). */
export function rollFleetCovert(s: GameStateV2, ctx: SystemCtx): void {
  for (const t0 of fleetCovertTerms(s, false)) {
    if (t0.attempts <= 0) continue;
    const k = `${t0.act}:${ctx.day}:${t0.versionId}`;
    const u = covertDraw(s, k);
    if (!(u < t0.attempts)) continue;
    const v = versionById(s, t0.versionId);
    if (!v) continue;
    const t = { ...t0, catch: internalOversight(s, v, t0.apparent).catch * oversightOpen(s, v) };
    noteCovert(s, ctx, v, t, covertOutcome(t, u), covertDraw(s, `${k}:sev`));
  }
}

/** Every covert act's terms today (tests, notes, E11's view): sabotage at the safety agents' share of safety work, steering
 *  and successor steering per R&D part, the fleets' daily acts. Engine only. */
export function covertDanger(s: GameStateV2): CovertTerms[] {
  const saf = safetySabotage(s, safetyFleet(s).aiShare);
  const succ = rdParts(s).map((p) => itemTerms(s, p.v, 'SUCCSTEER', p.share, WORK_TYPES[SLOT_WORK[p.slot]].H));
  return [...(saf ? [saf] : []), ...steerTerms(s), ...succ, ...fleetCovertTerms(s)];
}

/** The lab's estimate of SAFSAB attempts per safety work item of which AI does `share` (previews: Trusted to AI,
 *  Investigate): the same formula on what the player knows: believed SAND + SCHEME (beliefs), the measured general level
 *  for capability, no oversight term (unknown to the lab). Never reads truth. */
export function believedSabotage(s: GameStateV2, share: number): number {
  const v = safetyAgentVersion(s);
  if (!v || share <= 0) return 0;
  const def = COVERT_ACTS.SAFSAB;
  const x = clamp01((v.beliefs.SAND?.est ?? 0) + (v.beliefs.SCHEME?.est ?? 0));
  const af = autonomyOf(WORK_TYPES.SAF_EXP.H) * CHANNEL_AFFORD.internal;
  return clamp01(def.kappa * dispositionOf(x) * capabilityOf(v.evals.measuredL ?? 0, def) * (1 - def.alpha + def.alpha * af) * clamp01(share));
}
