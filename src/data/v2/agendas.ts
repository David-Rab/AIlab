// Safety research agendas AG01–AG18 (V2-SPEC §3.5.2, research/14 §1.2). Owner: WS2.
// Every numeric parameter is a research/14 [D] value (R14 states there is no expert survey of per-agenda credences);
// Compute ranges are R14's "serious programme at one frontier lab" column, `computeRef` is their midpoint.
import type { AgendaId, Column, SafetyLatents, ToolFamily, TraitId } from '../../engine/v2/types';
import { PHI_FLOP_PER_H100E_DAY } from './calibration';
import { C_UNIT_FLOP_PER_DAY } from './workTypes';

export type AgendaFamily = ToolFamily | 'fix' | 'contain' | 'meta' | 'BB+';

export interface AgendaDef {
  id: AgendaId;
  name: string;
  /** Beta(a, b) prior on efficacy e. */
  prior: [number, number];
  /** Latent loadings: e = clamp(Beta + Σ load·λ, 0, 1). Magnitudes [D] (M2: spread × 0.75 for S1): ++ .15, + .09,
   *  weak .045, λ6 adversary −.09. */
  loadings: Partial<Record<keyof SafetyLatents, number>>;
  /** Months to the first expected result at serious staffing (R8: the effort of every project on the line). */
  T1: number;
  /** Capability robustness (model v3 E6): strength halves when the overseen model is oHalf OOM of effective compute above
   *  the start model V0; k = slope (data/v2/oversight.ts: D = 1/(1 + 10^(k·κ·(x − oHalf)))). OOM literal (1e9 = never
   *  decays). RD-U03: these are the values v2's M½ gave on the ai2027 reference path before the conversion was removed
   *  (M½ 25 → 4.218, 30 → 4.678, 250 → 10.018, 2000 → 13.788). */
  oHalf: number;
  k: number;
  /** Goodhart susceptibility G. */
  G: number;
  /** Automation factor (how much AI labour speeds the line's projects). */
  auto: number;
  family: AgendaFamily;
  coverage: TraitId[];
  /** R14 compute range as a fraction of the lab's total compute; `computeRef` is the midpoint (C_ref). */
  computeRange: [number, number];
  computeRef: number;
  /** RD-R02a: the line project's experiment-compute need as a multiple of a capability project's (C_UNIT_FLOP_PER_DAY):
   *  computeRef × the leader lab's day-0 compute (1e6 H100e) × PHI ÷ C_UNIT = computeRef × 96.8 (the pre-RD-R02a reference
   *  compute, restated in the shared unit). At this compute a line's c = 1. */
  computeNeed: number;
  /** Latent the agenda's tools mainly rest on: tools sharing it are correlated evidence (§3.5.6, R14 §1.6B). */
  mainLatent: keyof SafetyLatents | 'none';
  /** Tree column of the line's follow-up project (the column most of its nodes sit in). */
  column: Column;
}

const INF = 1e9;
const mid = (r: [number, number]) => (r[0] + r[1]) / 2;

type Row = Omit<AgendaDef, 'computeRef' | 'computeNeed' | 'column'>;
const ROWS: Row[] = [
  { id: 'AG01', name: 'Ambitious mech interp', prior: [1.5, 4], loadings: { legibility: 0.09 }, T1: 9, oHalf: 13.788, k: 0.5, G: 0.5, auto: 0.6, family: 'WB', coverage: ['SCHEME', 'AF', 'SUCC'], computeRange: [0.03, 0.08], mainLatent: 'legibility' },
  { id: 'AG02', name: 'Applied interp', prior: [3, 3], loadings: { legibility: 0.09 }, T1: 4, oHalf: 10.018, k: 0.7, G: 0.8, auto: 0.9, family: 'WB', coverage: ['EA', 'TGAME', 'AF', 'SCHEME'], computeRange: [0.01, 0.03], mainLatent: 'legibility' },
  { id: 'AG03', name: 'RepE / steering', prior: [2.5, 3], loadings: { legibility: 0.09 }, T1: 4, oHalf: 10.018, k: 0.7, G: 0.6, auto: 0.9, family: 'WB', coverage: ['SYC', 'PERSONA', 'EA'], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG04', name: 'Heuristic args / ELK', prior: [1, 6], loadings: { legibility: 0.045, formalizability: 0.15 }, T1: 24, oHalf: INF, k: 0, G: 0.1, auto: 0.5, family: 'OR', coverage: ['SCHEME', 'AF'], computeRange: [0.001, 0.003], mainLatent: 'formalizability' },
  { id: 'AG05', name: 'Scalable oversight', prior: [2, 4], loadings: { cotLoadBearing: 0.09, verificationAdvantage: 0.15, schemingDefault: -0.09 }, T1: 9, oHalf: 10.018, k: 1, G: 0.3, auto: 0.6, family: 'BB+', coverage: ['SYC', 'RH', 'CONCEAL', 'PROXY'], computeRange: [0.03, 0.1], mainLatent: 'verificationAdvantage' },
  { id: 'AG06', name: 'Weak-to-strong', prior: [2, 4], loadings: { verificationAdvantage: 0.09, benignGeneralization: 0.09, schemingDefault: -0.09 }, T1: 6, oHalf: 4.218, k: 1, G: 0.2, auto: 0.8, family: 'fix', coverage: ['SYC', 'PROXY'], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG07', name: 'AI control', prior: [4, 2.5], loadings: { cotLoadBearing: 0.09 }, T1: 3, oHalf: 4.678, k: 2, G: 0.2, auto: 1.0, family: 'contain', coverage: ['SCHEME', 'POWER', 'COLLUDE'], computeRange: [0.01, 0.05], mainLatent: 'cotLoadBearing' },
  { id: 'AG08', name: 'Model organisms & evals', prior: [4, 2], loadings: { verificationAdvantage: 0.09, schemingDefault: -0.09 }, T1: 3, oHalf: 4.218, k: 1, G: 0.5, auto: 1.0, family: 'BB', coverage: ['RH', 'EA', 'AF', 'SCHEME', 'SAND', 'POWER'], computeRange: [0.01, 0.03], mainLatent: 'verificationAdvantage' },
  { id: 'AG09', name: 'CoT monitorability', prior: [3.5, 2.5], loadings: { cotLoadBearing: 0.15 }, T1: 3, oHalf: 10.018, k: 1, G: 0.9, auto: 0.9, family: 'COT', coverage: ['RH', 'CONCEAL', 'AF', 'SAND', 'SCHEME'], computeRange: [0.004, 0.006], mainLatent: 'cotLoadBearing' },
  { id: 'AG10', name: 'Guaranteed-safe AI', prior: [1, 5], loadings: { formalizability: 0.15 }, T1: 18, oHalf: INF, k: 0, G: 0, auto: 0.8, family: 'OR', coverage: [], computeRange: [0.008, 0.012], mainLatent: 'formalizability' },
  { id: 'AG11', name: 'Scientist AI guardrail', prior: [1.5, 5], loadings: { formalizability: 0.09 }, T1: 18, oHalf: 10.018, k: 0.5, G: 0.2, auto: 0.6, family: 'OR', coverage: ['POWER'], computeRange: [0.02, 0.05], mainLatent: 'formalizability' },
  { id: 'AG12', name: 'Agent foundations', prior: [1, 8], loadings: {}, T1: 36, oHalf: INF, k: 0, G: 0, auto: 0.2, family: 'fix', coverage: ['CORRIG'], computeRange: [0, 0.002], mainLatent: 'none' },
  { id: 'AG13', name: 'Dev interp / SLT', prior: [1.5, 5], loadings: { legibility: 0.09, benignGeneralization: 0.09 }, T1: 12, oHalf: 10.018, k: 0.5, G: 0.3, auto: 0.6, family: 'WB', coverage: ['TGAME', 'AF'], computeRange: [0.005, 0.01], mainLatent: 'legibility' },
  { id: 'AG14', name: 'Cooperative AI', prior: [2, 4], loadings: {}, T1: 9, oHalf: 10.018, k: 1, G: 0.4, auto: 0.7, family: 'BB', coverage: ['COLLUDE', 'SUCC'], computeRange: [0.004, 0.006], mainLatent: 'none' },
  { id: 'AG15', name: 'Unlearning & curation', prior: [3, 3], loadings: { benignGeneralization: 0.09 }, T1: 6, oHalf: 10.018, k: 0.7, G: 0.2, auto: 0.9, family: 'fix', coverage: [], computeRange: [0.01, 0.03], mainLatent: 'benignGeneralization' },
  { id: 'AG16', name: 'Adversarial robustness', prior: [3, 3], loadings: {}, T1: 3, oHalf: 10.018, k: 1, G: 0, auto: 1.0, family: 'fix', coverage: [], computeRange: [0.02, 0.05], mainLatent: 'none' },
  // AG17 "5-15 FTE plus lots of compute (OpenAI pledged 20%)": compute ref [D] 5-15%.
  { id: 'AG17', name: 'Automated alignment research', prior: [3, 3], loadings: { verificationAdvantage: 0.15, schemingDefault: -0.09 }, T1: 3, oHalf: 10.018, k: 1, G: 0, auto: 1.0, family: 'meta', coverage: [], computeRange: [0.05, 0.15], mainLatent: 'verificationAdvantage' },
  { id: 'AG18', name: 'Training-signal design', prior: [3.5, 3], loadings: { benignGeneralization: 0.15 }, T1: 3, oHalf: 4.218, k: 1, G: 0.5, auto: 1.0, family: 'fix', coverage: ['SYC', 'RH', 'PERSONA', 'CONCEAL', 'SCHEME'], computeRange: [0.02, 0.1], mainLatent: 'benignGeneralization' },
];

/** Column of each line's follow-up project (TECH-TREE §2.4–2.6: where its nodes sit). */
const LINE_COLUMN: Record<AgendaId, Column> = {
  AG01: 'interp', AG02: 'interp', AG03: 'interp', AG04: 'evals', AG05: 'evals', AG06: 'alignment', AG07: 'evals', AG08: 'evals', AG09: 'evals',
  AG10: 'evals', AG11: 'evals', AG12: 'alignment', AG13: 'interp', AG14: 'evals', AG15: 'alignment', AG16: 'evals', AG17: 'evals', AG18: 'alignment',
};

/** RD-R02a conversion of computeRef (a share of the leader lab's day-0 compute, 1e6 H100e) into capability project
 *  compute units: 1e6 × PHI ÷ C_UNIT_FLOP_PER_DAY = 11 × 0.88 ÷ (0.35 × RE_LABOUR_UNIT) = 13.8 (DAY0_EXPERIMENT_SHARE; 96.8 at AI 2027's 5%). */
const NEED_PER_REF = (1e6 * PHI_FLOP_PER_H100E_DAY) / C_UNIT_FLOP_PER_DAY;
export const AGENDAS: AgendaDef[] = ROWS.map((r) => {
  const computeRef = Math.max(0.0005, mid(r.computeRange));
  return { ...r, computeRef, computeNeed: computeRef * NEED_PER_REF, column: LINE_COLUMN[r.id] };
});

export const AGENDA_IDS: AgendaId[] = AGENDAS.map((a) => a.id);
export const AGENDA_BY_ID = Object.fromEntries(AGENDAS.map((a) => [a.id, a])) as Record<AgendaId, AgendaDef>;
/** Research lines are tree projects for safety science teams (R8, STRUCTURE §4.5): a project's result is one finding.
 *  Model v3 E1: the project runs stages (below; safety/lineProjects.ts) whose ideation rate is (capacity ÷
 *  SERIOUS_CAP)^λ (taste does not speed it; models/research.ts sciWorkRate), so a line staffed at "serious" capacity (with its engineers and compute) gets its first result
 *  after T₁ months, the pre-R8 hazard's expected time at Serious funding (pre-E1: progress/day = √(capacity ÷
 *  SERIOUS_CAP) / (30·T₁) × compute^0.3 × AI labour). SERIOUS_CAP is a serious programme's capacity in standard science
 *  teams (heads/40 × 1.5 in the team's specialty) [calibration: RefBot keeps one team on each of its four
 *  lines, ≈ its pre-R8 Seed funding (a quarter of serious): a non-matching Strong team is 0.25, a matching one 0.375].
 *  6 (a matching team exactly at Seed) left the mixed bot unable to keep up before SAR (S5); 2–3 made RefBot's
 *  understanding hold at SAR (S5). */
export const SERIOUS_CAP = 4;
// ───────────────────────────── line projects on the project mechanism (model v3 E1) ─────────────────────────────
// MODEL-V3 §11.7 / §5.3: a line project's stages are ideation (safety scientists), small experiments and a
// validation on the frontier model (safety research engineers with experiment compute from the safety pool, the
// project-level experiment CES of capability projects). Reference inputs (rate 1 in every stage): a serious programme
// (science capacity SERIOUS_CAP), SAF_RE_ASK labour units of research engineers and the agenda's
// compute need (computeNeed × C_UNIT_FLOP_PER_DAY, = computeRef of the leader lab's day-0 compute); there the first result arrives after T₁ months, the
// pre-E1 pacing (research/14 §1.2–1.3). Above or below it every stage speeds up or slows down with its own inputs.

/** Shares of T₁ each stage takes at reference inputs (they sum to 1, so the first result takes T₁) [D: ideation is the
 *  shortest step of a safety project; validation on the frontier model the longest]. */
export const SAF_STAGES = { idea: 0.2, small: 0.35, val: 0.45 } as const;
/** RD-R02a: a serious programme's line experiments ask this many experiment-labour units (RE_LABOUR_UNIT research-engineer
 *  team-equivalents each, the capability unit): 0.25 = 50 heads (the pre-RD-R02a SAF_RE_UNIT) [D, calibration];
 *  a project asks in proportion to its science staffing (× capacity ÷ SERIOUS_CAP, at most LINE_MULT_MAX). A staffing
 *  need, as capability's RE_FULL_PROJECT, not a unit. */
export const SAF_RE_ASK = 0.25;

/** Cap on the line multiplier (capacity ÷ SERIOUS_CAP) where the pre-R8 code read funding (AG18 healing): the old Major
 *  level. */
export const LINE_MULT_MAX = 2.5;

/** SR-09 validation jobs (SAFETY-REDESIGN §3.2; replace tool upkeep): plant known behaviour in a test copy of a model
 *  (a model organism) and count how often the instrument finds it, as sleeper-agent probes and auditing games do
 *  [S: research/06 §2.9, research/20 F6]. A job takes VAL_ENGINEERS safety research engineers (heads; AI
 *  labour of safety experiments carries part, ÷ m) for VAL_DAYS at full staffing, and VAL_COMPUTE_FRAC of a serious
 *  project's experiment compute on the instrument's line while it runs; it plants VAL_N cases. A port (a validated
 *  instrument on a new model) is the same job. [D: costs; [R] pending, research/20 §G gives eval costs, not organism
 *  costs (§6 row 17).] */
/** SR-24b: 8 × 15 = 120 engineer-days per job (was 15 × 30 = 450, above every sourced figure) [D: proxy C1, C3 in
 *  research/RD-SR24-safety-params.md §1a: audit labour 0.2–30 person-days per validation (Marks et al. 2025 arXiv
 *  2503.10965 Table 1; Taylor et al. 2025 arXiv 2512.07810 Table 1, ≈240 blue-team person-hours); about 2× C3's blue
 *  budget, leaving room for the unreported organism build on a frontier model]. */
export const VAL_ENGINEERS = 8;
export const VAL_DAYS = 15;
/** [D: no sourced range (research/RD-SR24-safety-params.md §1a): an organism is a LoRA or small SFT+RL (C2, C4); kept as
 *  a stand-in]. */
export const VAL_COMPUTE_FRAC = 0.25;
/** [S: inside the sourced 5–56 planted cases per validation, research/RD-SR24-safety-params.md §1a C1, C3, C4, C5]. */
export const VAL_N = 20;
/** SR-24b organism realism (OD-7 (a)): recall on planted model organisms overstates recall on the real model's natural
 *  traits: real recall = planted recall × r, r a hidden per-world draw from U[lo, hi] (HiddenWorld.organismRealism); the
 *  lab knows only the range [D: proxy, research/RD-SR24-safety-params.md §1b R3, R4: low end AuditBench arXiv 2602.22755
 *  §4 Fig. 4 (TD+KTO 22.2% ÷ SDF+SFT 51.3% = 0.43); high end Goldowsky-Dill et al. 2025 arXiv 2502.03407 (AUROC
 *  0.96–0.999 from simple to realistic prompted deception); R2: no measured organism → natural ratio exists (Smith,
 *  Chughtai, Nanda 2025 arXiv 2511.22662)]. CAL-S: kept as the proxy; abstracts re-checked (AuditBench: demonstration-
 *  trained and adversarially trained organisms are harder to audit; Goldowsky-Dill: "AUROCs between 0.96 and 0.999",
 *  "insufficient as a robust defence"); no direct organism → natural measurement exists (research/CAL-safety-sources.md
 *  §5) [proxy, low]. */
export const ORGANISM_REALISM = { lo: 0.4, hi: 1.0 } as const;
/** CP3i (designer decision 2026-11-23): method efficacy at scale. Each run method's sourced effect was measured on
 *  models of one capability; it holds there. Above that capability its true strength is a hidden per-world draw q
 *  (HiddenWorld.methodScale, one per method), reached smoothly: the log-space strength s0·e (safety/methods.ts) is ×
 *  (1 − τ + τ·q), τ = smoothstep((oom − tested) ÷ METHOD_SCALE.k) over the OOM of effective compute above the tested
 *  model. The lab knows only the range (q̄ = its midpoint, the spread widens predicted beliefs); it never sees q.
 *  `tested` = OOM of the source's largest model relative to V0 (the 2025 start model, G 27.66 ≈ 3e26 FLOP pretraining
 *  + RL): log10(source training FLOP ÷ 3e26) where reported, else ≈ V0 for 2025 frontier models [D]. */
export const METHOD_TESTED_OOM: Record<string, { oom: number; src: string }> = {
  'T-ANTISCHEME': { oom: 0, src: 'Schoen et al. 2025 arXiv 2509.15541: o3, o4-mini (2025 frontier ≈ V0)' },
  'T-INOC': { oom: 0, src: 'MacDiarmid et al. 2025 arXiv 2511.18397: production Claude RL (the F2 organism is V0)' },
  'T-CONFESS': { oom: 0, src: 'OpenAI 2025 arXiv 2512.08093: GPT-5-Thinking (2025 frontier ≈ V0)' },
  'T-PERSONA': { oom: -2.6, src: 'Chen et al. 2025 arXiv 2507.21509: Qwen2.5-7B, Llama-3.1-8B (≈ 7e23 FLOP)' },
  'T-W2S': { oom: -1.2, src: 'Burns et al. 2023 arXiv 2312.09390: GPT-4 student (≈ 2e25 FLOP, Epoch)' },
  'T-UNDO': { oom: -3, src: 'distill-after-unlearn papers: open models ≤ ~8B [D]' },
  'T-CAST': { oom: 0, src: 'no empirical test (Harms 2024 is a proposal): its ×0.7 is a stand-in for today\'s models [D]' },
};
/** CP3i stand-ins (no source gives either): q ~ U[lo, hi] per world per method, and the transition width k OOM above
 *  the tested model: about one frontier generation of training compute (GPT-3 3.1e23 → GPT-4 2.1e25 FLOP, 1.8 OOM,
 *  Epoch AI), i.e. by the next generation the tested effect says nothing beyond the range. RF-S10 (designer decision 8,
 *  2026-11-23): the range is two-sided around the tested effect (q = 1): a method may stop working at scale (q = 0) or
 *  work up to twice as strongly (q = 2, the exponent doubled) [stand-in: the width mirrors CP3i's downside]; the lab's
 *  expectation is the tested effect. CAL-S (research/CAL-safety-sources.md §3): lo = 0 is observed (Hubinger et al. 2024
 *  arXiv 2401.05566: "The backdoor behavior is most persistent in the largest models": safety training that works on
 *  small models fails at scale); hi = 2 and k = 2 stay [D stand-in]: no primary source measures a method growing
 *  stronger at scale by a stated factor, nor the width of the transition. */
export const METHOD_SCALE = { lo: 0, hi: 2, k: 2 } as const;
/** The lab's belief about q: the range's midpoint (a uniform belief over [lo, hi]). */
export const METHOD_SCALE_BELIEVED = (METHOD_SCALE.lo + METHOD_SCALE.hi) / 2;
/** The lab's belief about r: the stated range's midpoint (a uniform belief over [lo, hi]). */
export const ORGANISM_REALISM_BELIEVED = (ORGANISM_REALISM.lo + ORGANISM_REALISM.hi) / 2;
/** SR-09: believed reliability away from the measured model is extrapolated: its 90% range widens by VAL_WIDEN_PER_OOM
 *  per OOM of capability gap; never measured (start tools, unlocked tools before a job): VAL_UNMEASURED_HALF on top [D]. */
export const VAL_WIDEN_PER_OOM = 0.06;
export const VAL_UNMEASURED_HALF = 0.15;

/** AG09 under latent reasoning (R14 §1.2: "250 / 1 legible → 5 / 2 neuralese"; v2 M½ 5 = the SC level; RD-U03: OOM literal, the value the removed reference-path conversion gave). */
export const AG09_LATENT = { oHalf: 2.492, k: 2 };
/** Measured level of the safety agent model needed to fund AG17, automated alignment research (§3.5.2). */
export const AG17_MIN_L = 10;
/** Tool verifiability for investigation corruption (§3.5.8). */
export const VERIFIABILITY: Record<ToolFamily, number> = { WB: 0.7, OR: 0.9, BB: 0.5, COT: 0.6 };

/** SR-10 (SAFETY-REDESIGN §4.3 channels 1–2): instrument trust. A reading of a trait disagrees with the latest reading
 *  of an INDEPENDENT instrument (another kind and another family) on the same model when |a − b| > DISAGREE_Z ·
 *  √(σa² + σb²) (the two readings' 90% test of a difference) [D]. A disagreement says one of them is wrong without
 *  saying which: it is recorded once per (model, trait, pair) and shown (the chip, the framework / case hook), and
 *  trust does not move (CAL2-S, designer decision 10: the automatic DISAGREE_DROP cut, an unsourced effect on beliefs,
 *  was deleted; review/safety.md §3 #8). Only a validation measures how wrong: it sets the trust factor on its model to
 *  measured ÷ believed (capped at TRUST_MAX); TRUST_EVIDENCE_CAP entries per instrument, DISAGREE_CAP disagreements
 *  kept [D]. */
export const DISAGREE_Z = 1.64;
export const TRUST_MAX = 1.5;
export const TRUST_EVIDENCE_CAP = 20;
export const DISAGREE_CAP = 40;
