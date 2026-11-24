// UB-C: SAFETY › Model readouts the approved mockup needs (design/ux/mockups/rd/DATA-c.md, items marked NEW). Pure view
// functions on beliefs, measurements and facts only, never hidden truth. Each states its home, unit and basis
// (UI-IA §2); units per VOCAB §1.
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_BY_ID } from '../../../data/v2/traits';
import { chanceCertainty, type Certainty } from '../core/certainty';
import { safetyLabour } from '../departments/workfit';
import { alignmentEvalView } from './alignmentEvals';
import { clamp01, RED_FLAG_TRAITS, versionById } from './common';
import { believedPenalty, combineTools } from './detection';
import { instrumentName, instrumentReads, instruments, type InstrumentKind } from './instruments';
import { CASE_WORK, INV_FTE, INV_MAX_DAYS, caseDailyWork, caseDays, caseH100e, defaultTools } from './investigations';
import { caseComputeScale } from './lineProjects';
import { oomOfLevel } from './oversight';
import { strengthBelieved } from './techniques';
import { trustLine, trustOf } from './trusted';
import type { GameStateV2, ModelVersion, TechniqueState, TraitId } from '../types';

const Z90 = 1.64;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

// ───────────────────────────── alignment evals in player words ─────────────────────────────

/** Player names of the alignment evals (data ids in data/v2/benchmarks.ts SAFETY_EVALS). Home: SAFETY › Model, In tests
 *  vs in real use · L1. Basis: F (names). */
export const ALIGN_EVAL_NAME: Record<string, string> = {
  schemeProbe: 'Scheming scenarios', agentStress: 'Agent stress tests', hackRate: 'Reward-hacking tasks', sabotage: 'Sabotage scenarios',
  honesty: 'Honesty scenarios', evalAware: 'Test-noticing scenarios',
};
export const alignEvalName = (id: string) => ALIGN_EVAL_NAME[id] ?? id;

/** One alignment eval that reads a hidden behaviour: k of n in tests (with its 90% range) and the believed real-use range
 *  (the test range × the believed test-vs-real gap). Home: SAFETY › Model, In tests vs in real use · L1. Unit: k of n,
 *  % (low–high). Basis: M (k of n, test range) → B (real-use range). */
export interface TestUseRow { id: string; name: string; trait: TraitId; k: number; n: number; lo: number; hi: number; realLo: number; realHi: number; day: number; by: 'self' | 'evalGov' | 'evalIndep' }
/** The model's in-tests vs in-real-use readout: the hidden-behaviour eval rows, how often it notices tests (Eval awareness
 *  belief with its 90% range, and the test-noticing eval's k of n if run), the believed factor by which real use exceeds
 *  tests, and the real-use logs (monitor or case readings next to test readings), if any. Home: SAFETY › Model · L1.
 *  Basis: M / B. */
export interface TestsVsUse {
  rows: TestUseRow[]; day?: number;
  notices: { est: number; lo: number; hi: number; measured?: { k: number; n: number } };
  gLo: number; gHi: number;
  logs?: { trait: TraitId; test: number; real: number; ratio: number }[];
}
const EVAL_TRAIT: Record<string, TraitId> = { schemeProbe: 'SCHEME', agentStress: 'POWER', hackRate: 'RH', sabotage: 'SAND' };
export function testsVsUse(v: Pick<ModelVersion, 'beliefs' | 'evals'>): TestsVsUse {
  const { rows, gap } = alignmentEvalView(v);
  const hid = rows.filter((r) => r.hidden);
  const ea = v.beliefs.EA;
  return {
    rows: hid.map((r) => ({ id: r.id, name: alignEvalName(r.id), trait: EVAL_TRAIT[r.id] ?? 'SCHEME', k: r.k, n: r.n, lo: r.lo, hi: r.hi, realLo: r.realLo, realHi: r.realHi, day: r.day, by: r.by })),
    ...(rows.length ? { day: Math.max(...rows.map((r) => r.day)) } : {}),
    notices: { est: ea?.est ?? 0, lo: gap.eaLo, hi: gap.eaHi, ...(gap.measured ? { measured: { k: gap.measured.k, n: gap.measured.n } } : {}) },
    gLo: gap.gLo, gHi: gap.gHi, ...(gap.logs ? { logs: gap.logs } : {}),
  };
}

// ───────────────────────────── evidence per trait ─────────────────────────────

/** Where a reading came from, in player kinds. */
export type EvidenceKind = 'start' | 'tests' | 'reasoning' | 'internals' | 'formal' | 'realUse' | 'case' | 'external';
const FAMILY_KIND: Record<string, EvidenceKind> = { BB: 'tests', COT: 'reasoning', WB: 'internals', OR: 'formal' };
export function evidenceKind(source: string): EvidenceKind {
  if (source.startsWith('inherit:') || source === 'stream' || source === 'prior') return 'start';
  if (source.startsWith('monitor/')) return 'realUse';
  if (source === 'case' || source.startsWith('case/')) return 'case';
  if (source.startsWith('external/')) return 'external';
  const fam = source.split('/')[1];
  return (source.startsWith('suite/') || source.startsWith('eval/')) && fam ? FAMILY_KIND[fam] ?? 'tests' : 'tests';
}

/** One source of a trait belief's evidence: its latest reading with the 90% range, and how much the source counts for
 *  (its readings' precision 1 / noise², normalised over every reading: the belief update's weights; the start belief
 *  counts, the predicted drift in training does not). `readings`: how many readings the source gave. */
export interface EvidenceRow { source: string; kind: EvidenceKind; name: string; detail: string; day: number; reading: number; lo: number; hi: number; weight: number; readings: number }
/** The evidence behind one trait belief of a model. Home: SAFETY › Model, the trait's evidence drawer · L2; the counts
 *  are the trait table's evidence chips · L1. Unit: % (low–high) per reading, counts-for share. Basis: M (readings),
 *  B (belief). `counts`: readings per kind (the start belief left out). `read`: an owned instrument reads the trait. */
export interface TraitEvidence {
  trait: TraitId; rows: EvidenceRow[]; counts: Partial<Record<EvidenceKind, number>>;
  est: number; lo: number; hi: number; certainty: Certainty; read: boolean;
}
export function traitEvidence(s: GameStateV2, v: ModelVersion, trait: TraitId): TraitEvidence {
  const b = v.beliefs[trait];
  const ev = b?.evidence ?? [];
  const own = instruments(s);
  const fam = (f: string) => own.filter((t) => t.family === f).map(instrumentName);
  // The training-stream entry is the predicted drift while it trained (a moved prior, not a reading): no weight.
  const prec = (e: { source: string; noise: number }) => (e.source === 'stream' ? 0 : 1 / Math.max(1e-6, e.noise) ** 2);
  const W = ev.reduce((a, e) => a + prec(e), 0);
  const bySource = new Map<string, { e: (typeof ev)[number]; w: number; n: number }>();
  for (const e of ev) { const g = bySource.get(e.source); bySource.set(e.source, { e: !g || e.day >= g.e.day ? e : g.e, w: (g?.w ?? 0) + prec(e), n: (g?.n ?? 0) + 1 }); }
  const rows: EvidenceRow[] = [...bySource.values()].sort((a, b) => a.e.day - b.e.day).map(({ e, w, n }) => {
    const kind = evidenceKind(e.source);
    const parts = e.source.split('/');
    let name: string;
    let detail: string;
    if (kind === 'start') {
      const p = versionById(s, e.source.slice(8));
      name = `Started from ${p?.name ?? 'its parent'}`;
      detail = 'its belief at training';
      if (e.source === 'stream') { name = 'Training since'; detail = 'predicted change while it trained'; }
      if (e.source === 'prior') { name = 'Public starting estimate'; detail = 'what is published for models of its size'; }
    } else if (e.source.startsWith('eval/')) {
      const id = parts[2] ?? '';
      const r = v.evals.safety[id];
      name = alignEvalName(id);
      detail = `alignment eval${r?.n ? ` · ${r.k} of ${r.n}` : ''}${id !== 'evalAware' && id !== 'honesty' ? ' · scaled to real use' : ''}`;
    } else if (e.source.startsWith('suite/')) {
      const names = fam(parts[1] ?? '');
      name = kind === 'tests' ? 'Behavioural tests' : kind === 'reasoning' ? (names.length === 1 ? names[0] : 'Reasoning readers') : kind === 'internals' ? 'Internals readings' : 'Formal checks';
      detail = kind === 'reasoning' ? 'reads its written reasoning' : names.join(', ') || 'your test suite';
    } else if (kind === 'realUse') { const k = evidenceKind(`suite/${parts[1] ?? ''}`); name = 'Real-use logs'; detail = `monitors on its work · ${k === 'internals' ? 'internals' : k === 'reasoning' ? 'reasoning' : 'behaviour'}`; }
    else if (kind === 'case') { name = 'Case verdict'; detail = 'a case on this model'; }
    else if (kind === 'external') { name = 'External evaluation'; detail = 'outside evaluators'; }
    else { name = 'Tests'; detail = 'your test suite'; }
    return { source: e.source, kind, name, detail, day: e.day, reading: e.reading, lo: clamp01(e.reading - Z90 * e.noise), hi: clamp01(e.reading + Z90 * e.noise), weight: W > 0 ? w / W : 0, readings: n };
  });
  const counts: TraitEvidence['counts'] = {};
  for (const r of rows) if (r.kind !== 'start') counts[r.kind] = (counts[r.kind] ?? 0) + r.readings;
  const est = b?.est ?? 0;
  const sd = b?.sd ?? 0.35;
  const lo = clamp01(est - Z90 * sd);
  const hi = clamp01(est + Z90 * sd);
  return { trait, rows, counts, est, lo, hi, certainty: chanceCertainty(lo, hi), read: own.some((t) => instrumentReads(t).includes(trait)) };
}

/** Whether an instrument's kind has produced a reading on `trait` for this model. Home: the evidence drawer's "how often
 *  each instrument would show it" · L2 ("no reading yet"). Basis: M. */
export function instrumentHasReading(v: ModelVersion, trait: TraitId, t: Pick<TechniqueState, 'family'>): boolean {
  return (v.beliefs[trait]?.evidence ?? []).some((e) => /^(suite|eval|monitor)\//.test(e.source) && e.source.split('/')[1] === t.family);
}

// ───────────────────────────── framework line, belief sources ─────────────────────────────

/** The Misalignment-signs rule's line on the top of a belief's 90% range and the traits it reads. Home: SAFETY › Model
 *  trait table (dashed line) · L1. Unit: %. Basis: F (your framework rule). */
export function frameworkLine(s: GameStateV2): { est: number; traits: TraitId[] } {
  return { est: trustLine(s), traits: [...RED_FLAG_TRAITS] };
}
/** Hidden-goal traits (the sight limit's set). */
export const HIDDEN_GOAL_TRAITS: readonly TraitId[] = CRITICAL_TRAITS;

/** Where a model's beliefs come from. Home: SAFETY › Model, Where these beliefs come from · L1. Basis: F (parent, dates,
 *  methods), M (evals run, trust). */
export interface BeliefSources {
  parent?: { name: string; day: number }; made: number;
  /** `kinds`: the suite's instrument kinds that read it, `labels` in player words ("the CoT monitor"). */
  evaluated?: { day: number; evals: number; kinds: InstrumentKind[]; labels: string[] };
  methods: string[];
  trusted: { yes: boolean; why: string };
}
export function beliefSources(s: GameStateV2, v: ModelVersion): BeliefSources {
  const p = versionById(s, v.parentVersionId);
  const ev = Object.values(v.beliefs).flatMap((b) => b?.evidence ?? []).filter((e) => !e.source.startsWith('inherit:'));
  const tests = ev.filter((e) => e.source.startsWith('eval/') || e.source.startsWith('suite/'));
  const evals = Object.values(v.evals.safety ?? {}).filter((r) => !!r?.n).length;
  const kinds = [...new Set(tests.filter((e) => e.source.startsWith('suite/')).map((e) => evidenceKind(e.source)))]
    .filter((k) => k === 'tests' || k === 'reasoning' || k === 'internals' || k === 'formal') as InstrumentKind[];
  const own = instruments(s);
  const FAM: Record<string, string> = { tests: 'BB', reasoning: 'COT', internals: 'WB', formal: 'OR' };
  const labels = kinds.map((k) => {
    if (k === 'tests') return 'the behavioural test suite';
    const names = own.filter((x) => x.family === FAM[k]).map(instrumentName);
    return names.length === 1 ? `the ${names[0]}` : k === 'reasoning' ? 'the reasoning readers' : k === 'internals' ? 'internals readings' : 'formal checks';
  });
  const t = trustOf(s, v);
  return {
    ...(p ? { parent: { name: p.name, day: v.day } } : {}), made: v.day,
    ...(tests.length ? { evaluated: { day: Math.max(...tests.map((e) => e.day)), evals, kinds, labels } } : {}),
    methods: (v.design?.methods ?? []).filter((m) => !String(m).startsWith('against:')).map((m) => TECHNIQUE_BY_ID[m]?.name ?? String(m)),
    trusted: { yes: t.trusted, why: trustWhy(t.why) },
  };
}
/** trustOf's reason in player words (no domain ids or raw levels). */
function trustWhy(why: string): string {
  if (/below the level where covert action/.test(why)) return 'its cyber skill is below the level where working around oversight succeeds';
  const m = why.match(/: (\w+) (?:at most|could be as high as) (\d+%)/);
  const tn = m ? TRAIT_BY_ID[m[1] as TraitId]?.name ?? m[1] : '';
  if (!/ not trusted: /.test(why) && m) return `${tn} at most ${m[2]} (top of your range), under your framework's line`;
  if (m) return `${tn} could be as high as ${m[2]} (top of your range), over your framework's line${/not measured/.test(why) ? ', and its capability is not measured' : ''}`;
  return why;
}

// ───────────────────────────── a case on one trait ─────────────────────────────

/** What a case on one trait of a model would take and read (the Open case preview's numbers: believed reliability at the
 *  measured level, days at the engineers asked, compute at the default 5% of the safety pool). Home: SAFETY › Model,
 *  evidence drawer · L2. Unit: days · engineers · H100e · %. Basis: B·fc. The belief range after a verdict is not given:
 *  the engine's preview has none for a benign verdict (DATA-c.md NEW). */
export interface TraitCase { trait: TraitId; fte: number; days: number; done: number; h100e: number; reliability: number; instruments: string[]; kinds: number; aiShare: number }
export function traitCase(s: GameStateV2, v: ModelVersion, trait: TraitId, fte = 10, computeShare = 0.05): TraitCase {
  const f = Math.max(INV_FTE[0], Math.min(INV_FTE[1], fte));
  const tools = defaultTools(s, [trait]).map((id) => s.player.safety.techniques[id]).filter((t): t is TechniqueState => !!t?.unlocked);
  const scale = caseComputeScale(s, computeShare);
  const perDay = caseDailyWork(s, f, scale);
  const L = v.evals.measuredL ?? 0;
  const x = oomOfLevel(s.hidden.timeline, L); // the public level scale
  const rel = combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[trait] ?? 0) * strengthBelieved(s, t, x) * believedPenalty(s, v, trait, t.family, L) })));
  const { days, done } = caseDays(perDay, CASE_WORK);
  return {
    trait, fte: f, days: Math.min(days, INV_MAX_DAYS), done, h100e: caseH100e(s, computeShare * scale), reliability: r3(rel),
    instruments: tools.map(instrumentName), kinds: new Set(tools.map((t) => t.family)).size, aiShare: safetyLabour(s).exp.A,
  };
}
