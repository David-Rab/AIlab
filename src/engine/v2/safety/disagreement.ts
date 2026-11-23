// SR-10 (SAFETY-REDESIGN §4.3 channels 1–2): how the player learns an instrument is wrong, from observations only.
//
// 1. DISAGREEMENT. Each reading of a trait (detection.ts observeVersion, source "<use>/<family>") is compared with the
//    latest reading of every INDEPENDENT instrument on the same trait of the same model: another instrument kind
//    (tests / reasoning / internals / logs / formal) AND another family (logs read through the reasoning or internals
//    instruments, so logs/COT and reasoning/COT are one instrument in two settings). Outside each other's ranges
//    (|a − b| > DISAGREE_Z·√(σa² + σb²)) it is a disagreement: recorded once per (model, trait, pair) in
//    SafetyDept.disagreements, and every owned instrument of both families that reads the trait loses DISAGREE_DROP of
//    its believed reliability (trust factor, floor DISAGREE_FLOOR): one of them is wrong, the player is not told which.
// 2. VALIDATION (validation.ts completeValidation) sets the trust factor to measured ÷ believed on the validated model.
//    A false (sabotaged) instrument is exposed there only when humans ran the job: an AI-assisted validation of it
//    reports what it is believed to find.
// Readings, ranges and the trust factor are all player-visible numbers; nothing here reads hidden truth.
import { DISAGREE_CAP, DISAGREE_DROP, DISAGREE_FLOOR, DISAGREE_Z, TRUST_EVIDENCE_CAP, TRUST_MAX } from '../../../data/v2/agendas';
import type { BeliefEvidence, Disagreement, DisagreementSide, GameStateV2, ModelVersion, TechniqueState, ToolFamily, TraitId, TrustEvidence } from '../types';
import { INSTRUMENT_KIND_LABEL, instrumentKind, instruments, type InstrumentKind } from './instruments';

const FAMILIES: readonly ToolFamily[] = ['BB', 'COT', 'WB', 'OR'];

/** The instrument kind and family of a belief-evidence source "<use>/<family>" (null for prior / start / inherit /
 *  stream / case verdicts). */
export function readingOf(source: string): { kind: InstrumentKind; family: ToolFamily } | null {
  const i = source.lastIndexOf('/');
  if (i < 0) return null;
  const family = source.slice(i + 1) as ToolFamily;
  if (!FAMILIES.includes(family)) return null;
  return { kind: instrumentKind({ family }, source.slice(0, i)), family };
}

/** Independent instruments: another kind and another family. */
export const independent = (a: { kind: string; family: ToolFamily }, b: { kind: string; family: ToolFamily }) => a.kind !== b.kind && a.family !== b.family;

/** The player's trust factor on an instrument (1 = no evidence yet). */
export const trustOf = (t: Pick<TechniqueState, 'trust'>) => t.trust?.f ?? 1;

/** Set an instrument's trust factor and record why. */
export function setTrust(t: TechniqueState, f: number, e: Omit<TrustEvidence, 'f'>): void {
  const nf = Math.round(Math.max(0, Math.min(TRUST_MAX, f)) * 1000) / 1000;
  const evidence = [...(t.trust?.evidence ?? []), { ...e, f: nf }];
  t.trust = { f: nf, evidence: evidence.slice(-TRUST_EVIDENCE_CAP) };
}

const pairKey = (a: DisagreementSide, b: DisagreementSide) => [`${a.kind}/${a.family}`, `${b.kind}/${b.family}`].sort().join('|');
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * A new reading `o` (noise σ) of `trait` on v by family / use, against the belief's evidence BEFORE it is added. Records
 * a disagreement with each independent kind whose latest reading is outside the combined range (once per model, trait
 * and pair) and lowers the trust of both sides' owned instruments that read the trait. Returns the new disagreements.
 */
export function noteReading(s: GameStateV2, day: number, v: ModelVersion, trait: TraitId, family: ToolFamily, use: string, o: number, sigma: number, evidence: readonly BeliefEvidence[] | undefined): Disagreement[] {
  if (!evidence?.length) return [];
  const me: DisagreementSide = { kind: instrumentKind({ family }, use), family, reading: o, noise: sigma, day };
  const seen = new Set<string>();
  const out: Disagreement[] = [];
  for (let i = evidence.length - 1; i >= 0; i--) {
    const e = evidence[i];
    const r = readingOf(e.source);
    if (!r || !independent(me, r)) continue;
    const other: DisagreementSide = { kind: r.kind, family: r.family, reading: e.reading, noise: e.noise, day: e.day };
    const key = pairKey(me, other);
    if (seen.has(key)) continue; // only the latest reading of each other kind
    seen.add(key);
    if (Math.abs(o - e.reading) <= DISAGREE_Z * Math.sqrt(sigma ** 2 + e.noise ** 2)) continue;
    const dept = s.player.safety;
    const list = (dept.disagreements ??= []);
    if (list.some((d) => d.model === v.id && d.trait === trait && pairKey(d.a, d.b) === key)) continue;
    const d: Disagreement = { day, model: v.id, trait, a: other, b: me };
    list.push(d);
    if (list.length > DISAGREE_CAP) list.splice(0, list.length - DISAGREE_CAP);
    out.push(d);
    const note = `${INSTRUMENT_KIND_LABEL[other.kind as InstrumentKind]} read ${trait} in ${v.name} at ${pct(other.reading)}, ${INSTRUMENT_KIND_LABEL[me.kind as InstrumentKind]} at ${pct(o)}: one of them is wrong`;
    for (const t of instruments(s)) {
      if ((t.family !== me.family && t.family !== other.family) || (t.coverage[trait] ?? 0) <= 0) continue;
      const f = trustOf(t);
      if (f <= DISAGREE_FLOOR) continue;
      setTrust(t, Math.max(DISAGREE_FLOOR, f * (1 - DISAGREE_DROP)), { day, source: 'disagreement', model: v.id, note });
    }
  }
  return out;
}

/** Disagreements on a model (newest first), in player language. */
export function disagreementsOn(s: GameStateV2, model: string): { day: number; trait: TraitId; text: string }[] {
  return (s.player.safety.disagreements ?? []).filter((d) => d.model === model).reverse().map((d) => ({
    day: d.day, trait: d.trait,
    text: `${INSTRUMENT_KIND_LABEL[d.a.kind as InstrumentKind]} ${pct(d.a.reading)} vs ${INSTRUMENT_KIND_LABEL[d.b.kind as InstrumentKind]} ${pct(d.b.reading)} on ${d.trait}`,
  }));
}
