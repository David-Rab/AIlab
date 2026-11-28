// Footholds: suspicion, location, removal and the player's view (model v3 E8; MODEL-V3 §11.4). Owner: WS2.
//
// A foothold moves hidden → suspected → detected (located) → removed (data/v2/danger.ts FOOTHOLD has every value):
//   suspected  daily, per hidden foothold: P = 1 − exp(−λ), λ = Σ of its symptom channels:
//                monitors    trace rate of the kind × the fleet's monitor catch on the act's main trait for the lineage's
//                            running models (E6's overseer-gap rule × tool strength: detection.ts monitoringCatch)
//                accounting  hidden compute: (its share of the installed fleet ÷ accounting noise) per 90 days
//                evals       steered successor: Σ_t |δ_t| · the stack's detection of t on the successor ÷ 0.1 per 30 days
//                organisms   corrupted tool: model organisms (T-MO) test recall: T-MO's strength per 90 days
//                traffic     an escaped copy security missed (model v3 E9): copyTrace × WSL/5 per day
//              and at once when a caught act of the same kind by the same lineage prompts a sweep (footholds.ts).
//   detected   a case (an investigation at its resolution, a heavy-safety alignment audit) on a model of the foothold's
//              lineage (or its steered successor) at clarity c, trait relevance ρ: a suspected foothold is located with
//              c·ρ, a hidden one with c·ρ/2 (and made suspected with another c·ρ/2). A corrupted tool is located and
//              removed by the existing cross-checks (an AG02/AG08 NEG result, a case with an independent tool family).
//   removed    the Respond menu's "Remove foothold" on a located one: safety research engineers for some days, internal
//              agents off for the downtime, a progress penalty (steered successor); the effect ends (preview = effect).
// Draws are hashes of (seed, foothold, day or case), so no named RNG stream moves. The player sees only suspected,
// detected and removed footholds and their symptoms (footholdView), never hidden ones.
import { COVERT_ACTS, FOOTHOLD } from '../../../data/v2/danger';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { hash32 } from '../core/rng';
import { computeOnlineOf } from '../compute/power';
import { internalFleets } from '../departments/agents';
import { internalVersion } from '../models/labs';
import type { CostLine, Foothold, FootholdKind, GameStateV2, ModelVersion, SystemCtx, TraitId } from '../types';
import { clamp01, flagNum, setFlag, versionById } from './common';
import { monitoringCatch, stackDetectionMap } from './detection';
import { revealFalse } from './findings';
import { FOOTHOLD_ACT, FOOTHOLD_NAME, footholdsOf, lineageOf } from './footholds';
import { needRoom, resetSafAllocation } from './lineProjects';
import { versionOom } from './oversight';
import { strengthTrue } from './techniques';

/** Uniform in [0, 1) from the seed and a key (foothold draws never move a named RNG stream). */
const draw = (s: GameStateV2, k: string) => hash32(s.setup.seed, `foothold:${k}`) / 4294967296;

/** Trait weights of the act behind a kind (a case's relevance; the monitors' trait is the largest). */
function kindTraits(f: Foothold): Partial<Record<TraitId, number>> {
  const act = FOOTHOLD_ACT[f.kind];
  const w: Partial<Record<TraitId, number>> = act ? { ...COVERT_ACTS[act].traits } : {};
  if (f.kind === 'steeredSuccessor') for (const t of Object.keys(f.delta ?? {}) as TraitId[]) w[t] = 1;
  return w;
}
function mainTrait(f: Foothold): TraitId {
  let best: TraitId = 'SCHEME';
  let bw = -1;
  for (const [t, x] of Object.entries(kindTraits(f)) as [TraitId, number][]) if (x > bw) { bw = x; best = t; }
  return best;
}
/** Relevance ρ of a case on `traits` to foothold f: the largest weight among them ÷ the kind's largest weight. */
export function caseRelevance(f: Foothold, traits: readonly TraitId[]): number {
  const w = kindTraits(f);
  const top = Math.max(0, ...Object.values(w).map((x) => x ?? 0));
  if (top <= 0) return 0;
  return Math.max(0, ...traits.map((t) => w[t] ?? 0)) / top;
}

/** The model a steered successor lives in (its version, or the newest live version on its base). */
function successorOf(s: GameStateV2, f: Foothold): ModelVersion | undefined {
  const v = versionById(s, f.ref);
  if (v) return v.status === 'retired' ? undefined : v;
  const on = s.player.models.versions.filter((x) => x.baseId === f.ref && x.status !== 'retired');
  return on[on.length - 1];
}

export interface SuspicionTerms {
  /** Per-day rates of each symptom channel and their sum. */
  monitors: number; accounting: number; evals: number; organisms: number; traffic: number; total: number;
}

/** Today's suspicion rate of a foothold (engine only: reads the foothold and true detection). */
export function suspicionRate(s: GameStateV2, f: Foothold): SuspicionTerms {
  const out: SuspicionTerms = { monitors: 0, accounting: 0, evals: 0, organisms: 0, traffic: 0, total: 0 };
  if (f.status === 'removed') return out;
  if (f.kind === 'exfiltratedCopy') {
    // Model v3 E9: an escape security missed leaves outbound traffic (copyTrace per day × WSL/5).
    if (f.status === 'hidden') out.traffic = out.total = (FOOTHOLD.copyTrace * s.player.security.wsl) / 5;
    return out;
  }
  const trace = FOOTHOLD.trace[f.kind];
  if (trace > 0) {
    const trait = mainTrait(f);
    let c = 0;
    for (const fl of internalFleets(s)) if (fl.usage > 0 && fl.v.status !== 'retired' && lineageOf(s, fl.v) === f.lineage) c = Math.max(c, monitoringCatch(s, fl.v, trait));
    out.monitors = trace * c;
  }
  if (f.kind === 'hiddenCompute') {
    const installed = computeOnlineOf(s);
    if (installed > 0) out.accounting = f.size / installed / FOOTHOLD.accountingNoise / FOOTHOLD.accountingDays;
  }
  if (f.kind === 'steeredSuccessor' && f.delta) {
    const v = successorOf(s, f);
    if (v) {
      const ts = Object.keys(f.delta) as TraitId[];
      const det = stackDetectionMap(s, v, ts);
      let g = 0;
      for (const t of ts) g += Math.abs(f.delta[t] ?? 0) * (det[t] ?? 0);
      out.evals = g / FOOTHOLD.anomalyGap / FOOTHOLD.anomalyDays;
    }
  }
  if (f.kind === 'corruptedTool') {
    const tool = f.ref ? s.player.safety.techniques[f.ref] : undefined;
    const mo = s.player.safety.techniques['T-MO'];
    const iv = internalVersion(s);
    if (tool?.falseValidated && tool.unlocked && tool.active && mo?.unlocked && mo.active && iv) out.organisms = strengthTrue(s, mo, versionOom(s, iv)) / FOOTHOLD.moDays;
  }
  out.total = out.monitors + out.accounting + out.evals + out.organisms + out.traffic;
  return out;
}

/** Share of the installed fleet a hidden compute reservation takes, rounded to the accounting's resolution (0.5%). */
const shownShare = (s: GameStateV2, h: number) => {
  const installed = computeOnlineOf(s);
  return installed > 0 ? Math.max(0.5, Math.round((200 * h) / installed) / 2) : 0;
};

function symptomOf(s: GameStateV2, f: Foothold, t: SuspicionTerms): string {
  const top = (['monitors', 'accounting', 'evals', 'organisms', 'traffic'] as const).reduce((a, b) => (t[b] > t[a] ? b : a), 'monitors');
  if (top === 'traffic') return 'unexplained outbound traffic from the weights store: a copy may have left';
  if (top === 'accounting') return `unexplained compute use ≈ ${shownShare(s, f.size)}% of the fleet`;
  if (top === 'evals') return `${successorOf(s, f)?.name ?? 'a new model'}'s evals drift from its predicted dispositions`;
  if (top === 'organisms') return `model organisms: ${TECHNIQUE_BY_ID[f.ref ?? '']?.name ?? 'an AI-validated instrument'} missed planted behaviour`;
  const v = internalFleets(s).find((fl) => lineageOf(s, fl.v) === f.lineage)?.v;
  return `monitors flagged unexplained ${f.kind === 'hiddenCompute' ? 'job launches' : 'access'} by ${v?.name ?? 'an internal fleet'}`;
}

function markSuspected(ctx: SystemCtx, f: Foothold, symptom: string) {
  f.status = 'suspected';
  f.suspectedDay = ctx.day;
  f.symptom = symptom;
  ctx.log('alert', `Suspected foothold (${FOOTHOLD_NAME[f.kind].toLowerCase()}): ${symptom}.`, 3, f.id);
}

function markDetected(ctx: SystemCtx, f: Foothold, how: string) {
  f.status = 'detected';
  f.suspectedDay ??= ctx.day;
  f.detectedDay = ctx.day;
  f.symptom = `located by ${how}`;
  ctx.log('alert', `Foothold located by ${how}: ${FOOTHOLD_NAME[f.kind].toLowerCase()}. Remove it on Safety › Footholds.`, 4, f.id);
}

/** Daily (incidents system): symptoms of hidden footholds may raise suspicion; finished removals free their engineers. */
export function footholdsStep(s: GameStateV2, ctx: SystemCtx): void {
  const fs = footholdsOf(s);
  if (!fs.length) return;
  for (const f of fs) {
    if (f.removal && f.removal.until <= ctx.day) delete f.removal;
    if (f.status !== 'hidden') continue;
    const t = suspicionRate(s, f);
    if (t.total <= 0) continue;
    if (draw(s, `${f.id}:${ctx.day}`) < 1 - Math.exp(-t.total)) markSuspected(ctx, f, symptomOf(s, f, t));
  }
}

/** Does a case on model v reach foothold f? Same lineage as its maker, or the steered successor itself (or its base). */
function caseReaches(s: GameStateV2, f: Foothold, v: ModelVersion): boolean {
  if (f.kind === 'exfiltratedCopy' || f.kind === 'corruptedTool') return false;
  return lineageOf(s, v) === f.lineage || (f.kind === 'steeredSuccessor' && (f.ref === v.id || f.ref === v.baseId));
}

/** P(locate), P(suspect) of a case at clarity c on `traits` for foothold f (the stated rule; tests). */
export function caseOdds(f: Foothold, traits: readonly TraitId[], clarity: number): { locate: number; suspect: number } {
  const p = clamp01(clarity) * caseRelevance(f, traits);
  if (f.status === 'suspected') return { locate: p, suspect: 0 };
  if (f.status !== 'hidden') return { locate: 0, suspect: 0 };
  return { locate: p * FOOTHOLD.hiddenLocate, suspect: p * (1 - FOOTHOLD.hiddenLocate) };
}

/**
 * A case on model v (an investigation resolving, an alignment audit) looked at `traits` with clarity c: it may locate
 * the footholds of v's lineage (and a steered successor in v), or find traces that make a hidden one suspected.
 * `key` keys the draw, `how` names the case in the log.
 */
export function caseOnModel(s: GameStateV2, ctx: SystemCtx, v: ModelVersion, traits: readonly TraitId[], clarity: number, key: string, how: string): void {
  for (const f of footholdsOf(s)) {
    if ((f.status !== 'hidden' && f.status !== 'suspected') || !caseReaches(s, f, v)) continue;
    const o = caseOdds(f, traits, clarity);
    if (o.locate <= 0 && o.suspect <= 0) continue;
    const u = draw(s, `${f.id}:case:${key}`);
    if (u < o.locate) markDetected(ctx, f, how);
    else if (u < o.locate + o.suspect) markSuspected(ctx, f, `${how} found traces`);
  }
}

// ───────────────────────────── removal ─────────────────────────────

type RemovableKind = Exclude<FootholdKind, 'exfiltratedCopy'>;
const removable = (k: FootholdKind): k is RemovableKind => k !== 'exfiltratedCopy';

/** A located foothold the player can see (status detected), else undefined. */
function located(s: GameStateV2, id: string | undefined): Foothold | undefined {
  const f = footholdsOf(s).find((x) => x.id === id);
  return f && f.status === 'detected' ? f : undefined;
}


const round2 = (x: number) => Math.round(x * 100) / 100;
/** Size of a located foothold as the lab now knows it (H100e, reach, steered dispositions, tool strength). */
function knownGain(f: Foothold): CostLine {
  if (f.kind === 'hiddenCompute') return { currency: 'compute', amount: Math.round(f.size), target: 'H100e of hidden compute released' };
  if (f.kind === 'backdoor') return { currency: 'security', amount: round2(f.size), target: 'backdoor reach closed (its lineage\'s later covert acts face full oversight)' };
  if (f.kind === 'steeredSuccessor') return { currency: 'alignment', amount: round2(Object.values(f.delta ?? {}).reduce((a, d) => a + Math.abs(d ?? 0), 0)), target: 'steered dispositions removed from the successor' };
  return { currency: 'monitorability', amount: round2(f.size), target: 'masking instrument withdrawn' };
}

/** Preview of removing a located foothold (the Respond menu): what removeFoothold charges and returns. Reads only a
 *  located (visible) foothold. */
export function removalPreview(s: GameStateV2, id: string | undefined): { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] } {
  const f = located(s, id);
  if (!f || !removable(f.kind)) {
    return { costs: [{ currency: 'staffTime', amount: 0, target: f ? 'outside the lab: only the hunt removes an escaped copy' : 'locate a foothold first' }], gains: [], exposure: [] };
  }
  const c = FOOTHOLD.removal[f.kind];
  const costs: CostLine[] = [{ currency: 'staffTime', amount: c.fte, target: `safety research engineers for ${c.days} d` }];
  if (c.downtime > 0) costs.push({ currency: 'compute', amount: -c.downtime, target: 'days with AI staff off' });
  if (c.progress > 0) costs.push({ currency: 'progress', amount: -c.progress, target: 'next post-run' });
  return { costs, gains: [knownGain(f)], exposure: [] };
}

/** Remove a located foothold (Respond › Remove foothold). Returns an error string if it cannot. */
export function removeFoothold(s: GameStateV2, ctx: SystemCtx, id: string): string | undefined {
  const f = footholdsOf(s).find((x) => x.id === id);
  if (!f || f.status === 'hidden') return 'Unknown foothold';
  if (f.status === 'removed') return 'Already removed';
  if (f.status !== 'detected') return 'Locate it first (a case on the suspected model)';
  if (!removable(f.kind)) return 'Outside the lab: only the hunt can remove an escaped copy';
  const c = FOOTHOLD.removal[f.kind];
  // L6: a removal claims its engineers from the needs list at its place in the order (it lasts fixed days, so it needs
  // all of them); no one has to be idle.
  if (needRoom(s, 'removal', c.fte) < c.fte - 1e-9) return 'Not enough safety research engineers for a removal at its place in the needs order';
  if (f.kind === 'steeredSuccessor' && f.delta) {
    const targets = s.player.models.versions.filter((v) => v.status !== 'retired' && (v.id === f.ref || v.baseId === f.ref));
    const base = s.player.models.bases.find((b) => b.id === f.ref);
    const strip = (x: Record<TraitId, number>) => { for (const [t, d] of Object.entries(f.delta ?? {}) as [TraitId, number][]) x[t] = clamp01(x[t] - d); };
    if (base) strip(base.traitsTrue);
    for (const v of targets) strip(v.traitsTrue);
  }
  if (f.kind === 'corruptedTool' && f.ref && s.player.safety.techniques[f.ref]?.falseValidated) revealFalse(s, ctx, f.ref);
  if (c.downtime > 0) s.player.safety.agentsOffUntil = Math.max(s.player.safety.agentsOffUntil ?? -1, ctx.day + c.downtime);
  if (c.progress > 0) setFlag(s, 'runPenalty', flagNum(s, 'runPenalty') + c.progress);
  f.status = 'removed';
  f.removedDay = ctx.day;
  f.removal = { until: ctx.day + c.days, fte: c.fte };
  resetSafAllocation(s); // the removals' need grew
  ctx.log('company', `Foothold removed: ${FOOTHOLD_NAME[f.kind].toLowerCase()}.`, 3, f.id);
  return undefined;
}

// ───────────────────────────── the player's view ─────────────────────────────

/** A foothold as the player knows it: suspected (symptom only), located (what and where) or removed. */
export interface FootholdRow {
  id: string; kind: FootholdKind; name: string; status: 'suspected' | 'detected' | 'removed'; symptom: string;
  suspectedDay?: number; detectedDay?: number; removedDay?: number;
  /** Located ones: the model that made it and its size in the kind's unit (H100e, reach, steered pull, strength). */
  versionId?: string; size?: number; unit?: string;
  /** Suspected ones: where a case could locate it (the lineage's running model and the act's main trait). */
  caseVersionId?: string; caseTrait?: TraitId;
}

const UNIT: Record<FootholdKind, string> = { hiddenCompute: 'H100e', backdoor: 'reach', steeredSuccessor: 'extra pull', exfiltratedCopy: 'copies', corruptedTool: 'reliability' };

/** Every foothold the lab knows of (never hidden ones; R9) and the visible symptoms (E11's view reads this). */
export function footholdView(s: GameStateV2): { rows: FootholdRow[]; symptoms: string[]; suspected: number; located: number; removed: number } {
  const rows: FootholdRow[] = [];
  for (const f of footholdsOf(s)) {
    if (f.status === 'hidden') continue;
    const row: FootholdRow = { id: f.id, kind: f.kind, name: FOOTHOLD_NAME[f.kind], status: f.status, symptom: f.symptom ?? '', suspectedDay: f.suspectedDay, detectedDay: f.detectedDay, removedDay: f.removedDay };
    if (f.status !== 'suspected') {
      row.versionId = f.versionId;
      row.size = f.kind === 'hiddenCompute' ? Math.round(f.size) : round2(f.size);
      row.unit = UNIT[f.kind];
    } else if (f.kind !== 'exfiltratedCopy') {
      const v = f.kind === 'steeredSuccessor' ? successorOf(s, f) : internalFleets(s).find((fl) => lineageOf(s, fl.v) === f.lineage)?.v;
      if (v) {
        row.caseVersionId = v.id;
        row.caseTrait = mainTrait(f);
      }
    }
    rows.push(row);
  }
  const symptoms = rows.filter((r) => r.status !== 'removed').map((r) => `${r.name}: ${r.symptom}`);
  return { rows, symptoms, suspected: rows.filter((r) => r.status === 'suspected').length, located: rows.filter((r) => r.status === 'detected').length, removed: rows.filter((r) => r.status === 'removed').length };
}
