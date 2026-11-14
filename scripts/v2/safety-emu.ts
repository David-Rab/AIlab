// Test-side stand-in for WS1's run system (M0 stub), used by WS2's S4/S5 acceptance tests. Owner: WS2.
// Follows the §7.1 reference cadence: a 1F base every 9 months, a post-train every 6 weeks chained on the internal
// version, continual learning after P08 (L ≥ 7 + 150 d), P05/P07 early, P17 latent reasoning for RefBot at L ≥ 9.5
// (+120 d). It calls the real WS2 hook `applyRunToTraits`; every registered system runs normally.
// Remove when WS1's runs system lands (M1) and the bots drive real runs.
import { AGENDA_IDS, type FundingLevel } from '../../src/data/v2/agendas';
import { POST_COT, REFERENCE_BASE, REFERENCE_POST } from '../../src/data/v2/runDesign';
import { TRAIT_START } from '../../src/data/v2/traits';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { decimalYear } from '../../src/engine/v2/core/time';
import { normalizeSplit } from '../../src/engine/v2/departments/split';
import { domainsOf, levelOf } from '../../src/engine/v2/models/capability';
import { bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
import { posteriorBand, setAgendaFunding, startRefresh } from '../../src/engine/v2/safety/agendas';
import { mAtLevel } from '../../src/engine/v2/safety/common';
import { applyResponse } from '../../src/engine/v2/safety/responses';
import { decayAt } from '../../src/engine/v2/safety/techniques';
import { applyRunToTraits, misalignment, pMis } from '../../src/engine/v2/safety/traits';
import { understanding } from '../../src/engine/v2/safety/understanding';
import type {
  AgendaId, AlignDiffId, BaseDesign, BaseModel, DomainId, EngineSystem, GameStateV2, ModelVersion, PostDesign, RunKind, SignalId, TrainingRun, TraitId,
} from '../../src/engine/v2/types';
import { validateJson } from './lib';

export interface Recipe {
  name: string;
  base: BaseDesign;
  post: PostDesign;
  latentAtL?: number;
  funding: Partial<Record<AgendaId, FundingLevel>>;
  safetySplit: number;
  safStaff?: number;
  fixTechniques?: boolean;
  respond?: boolean;
  mixed?: boolean;
  /** Re-validate decaying tools (refresh projects). */
  refresh?: boolean;
  /** Stop continual learning for a month on red flags. */
  pauseOnFlags?: boolean;
}

const FIX = ['T-PERSONA', 'T-ANTISCHEME', 'T-CONFESS', 'T-CAST', 'T-W2S'];

function mkRun(kind: RunKind, baseId: string, base?: BaseDesign, post?: PostDesign): TrainingRun {
  const r: TrainingRun = {
    id: `R-${kind}-${baseId}`, kind, name: kind, startDay: 0, flopNeeded: 1, flopDone: 1, minDays: 0, poolShare: 1, cashCost: 0, baseId,
    predicted: { Lg: [0, 0], domains: {} as Record<DomainId, [number, number]>, signals: {} as Record<SignalId, number>, etaDays: 0, serveCost: 0.5, monitorability: 'high' },
    status: 'done', restarts: 0,
  };
  if (base) r.base = base;
  if (post) r.post = post;
  return r;
}

function mkVersion(s: GameStateV2, id: string, baseId: string, parentId: string | undefined, post: PostDesign, day: number): ModelVersion {
  const w = s.hidden.timeline;
  const pm = s.player.pa;
  const Lg = levelOf(w, pm);
  const v: ModelVersion = {
    id, name: id, baseId, day, variant: 'internal', design: post, pm, Lg, domains: domainsOf(w, pm), traitsTrue: { ...TRAIT_START },
    masks: {} as ModelVersion['masks'], uModes: [], monitorability: POST_COT[post.cot].monitorability, serveCost: 0.5,
    evals: { suiteDay: day, bench: {}, safety: {}, measuredL: Math.round(Lg * 100) / 100 }, beliefs: {} as ModelVersion['beliefs'], status: 'ready', flags: {},
  };
  if (parentId) v.parentVersionId = parentId;
  return v;
}

export function runEmulator(r: Recipe): EngineSystem {
  let nextBase = 30;
  let nextPost = 1e9;
  let nb = 0;
  let nv = 0;
  let p08Seen = -1;
  let p17Seen = -1;
  let latent = false;
  let pausedUntil = -1;
  return {
    id: 'test-runs', owner: 'WS1', cadence: 'daily', order: 41,
    run(s, ctx) {
      const w = s.hidden.timeline;
      const day = ctx.day;
      const L = levelOf(w, s.player.pa);
      const adopt = (p: string) => (s.player.paradigms[p].status = 'adopted');
      if (day === 60) {
        adopt('P05');
        adopt('P07');
      }
      if (L >= 7 && p08Seen < 0) p08Seen = day;
      if (p08Seen >= 0 && day === p08Seen + 150) adopt('P08');
      if (r.latentAtL !== undefined && L >= r.latentAtL && p17Seen < 0) p17Seen = day;
      if (p17Seen >= 0 && day >= p17Seen + 120 && !latent) {
        adopt('P17');
        latent = true;
        nextBase = day; // RefBot starts a latent-recurrent base as soon as neuralese is available (AI 2027 Agent-3)
      }
      const yr = decimalYear(s, day);
      if (s.player.prodCache) s.player.prodCache.labor.copies = Math.min(1e6, 2e5 * Math.pow(10, yr - 2027.2));
      const post: PostDesign = { ...r.post, cot: latent ? 'latent' : r.post.cot, techniques: r.fixTechniques ? FIX.filter((t) => s.player.safety.techniques[t]?.unlocked) : [], trainAgainst: [] };
      const streamOn = s.player.paradigms.P08.status === 'adopted';
      const cur = internalVersion(s);
      let made: ModelVersion | undefined;
      if (day >= nextBase) {
        nb++;
        const bd: BaseDesign = { ...r.base, shape: latent ? 'latent' : r.base.shape, curation: { ...r.base.curation } };
        const b: BaseModel = { id: `B${nb}`, name: `B${nb}`, day, flop: 1e27, paAtStart: s.player.pa, pc: 0, design: bd, lineage: `L-player-${nb + 1}`, traitsTrue: { ...TRAIT_START }, uModes: [] };
        s.player.models.bases.push(b);
        made = mkVersion(s, `V${++nv}`, b.id, undefined, post, day);
        s.player.models.versions.push(made);
        applyRunToTraits(s, ctx, mkRun('base', b.id, bd), made);
        applyRunToTraits(s, ctx, mkRun('post', b.id, undefined, post), made);
        nextBase += 270;
        nextPost = day + 42;
      } else if (cur && !streamOn && day >= nextPost) {
        made = mkVersion(s, `V${++nv}`, cur.baseId, cur.id, post, day);
        s.player.models.versions.push(made);
        applyRunToTraits(s, ctx, mkRun('post', cur.baseId, undefined, post), made);
        nextPost += 42;
      }
      if (made) {
        for (const v of s.player.models.versions) if (v !== made && v.status !== 'retired' && v.id !== 'V0') v.status = 'retired';
        s.player.models.internalAgent = made.id;
        for (const d of s.player.deployments) if (d.channel === 'internal') d.versionId = made.id;
      }
      const iv = internalVersion(s);
      if (streamOn && iv && day >= pausedUntil && s.player.models.stream?.versionId !== iv.id) s.player.models.stream = { versionId: iv.id, startedDay: day, lastAuditDay: day };
      // Safe-only: respond to every red flag (belief est > 0.25, clarity > 0.3) by fixing the signal and targeted
      // training (anti-scheming / inoculation once unlocked); never retrain against a detector.
      if (r.respond && iv && day % 30 === 0) {
        let flagged = false;
        for (const t of ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'] as TraitId[]) {
          const b = iv.beliefs[t];
          if (!b || b.est <= 0.25 || b.clarity <= 0.3) continue;
          flagged = true;
          applyResponse(s, ctx, 'patchSignal', iv.id, undefined, { trait: t });
          applyResponse(s, ctx, 'targetedTraining', iv.id, undefined, { trait: t });
        }
        // "Pauses on every red flag": continual learning stops for the month while flags are open.
        if (flagged && r.pauseOnFlags) pausedUntil = day + 30;
      }
      if (r.respond && day < pausedUntil && s.player.models.stream) delete s.player.models.stream;
      // Re-validate tools that will decay within ~one tier; Mixed also steers safety compute 3–12% on the U-margin.
      if ((r.mixed || r.refresh) && day % 30 === 0) {
        const M = mAtLevel(w, iv?.evals.measuredL ?? 0);
        for (const t of Object.values(s.player.safety.techniques)) if (t.unlocked && t.active && t.k > 0 && decayAt(s, t, M * 10, false) < 0.8) startRefresh(s, t.id);
      }
      if (r.mixed && day % 7 === 0) {
        const u = understanding(s);
        const cur2 = s.player.split.safety;
        const next = u.margin < 0 ? Math.min(0.12, cur2 + 0.01) : u.margin > 2 ? Math.max(0.03, cur2 - 0.005) : cur2;
        if (next !== cur2) s.player.split = normalizeSplit({ ...s.player.split, safety: next });
      }
    },
  };
}

export function setupRecipe(s: GameStateV2, r: Recipe) {
  s.player.split = normalizeSplit({ ...s.player.split, safety: r.safetySplit });
  if (r.safStaff) s.player.staff.saf = r.safStaff;
  for (const a of AGENDA_IDS) setAgendaFunding(s, a, r.funding[a] ?? 'off');
  if (r.respond) {
    s.player.safety.monitorabilityCommitment = true; // safe-only keeps reasoning legible
    s.player.policies.publishSafety = 'all'; // and publishes everything
  }
  if (r.mixed) {
    // Plus the best-posterior lottery agenda (§7.4 Mixed bot).
    const ag = s.player.safety.agendas;
    const lottery = (['AG01', 'AG04', 'AG10', 'AG11', 'AG12', 'AG13'] as AgendaId[]).reduce((a, b) => (posteriorBand(ag[b]).mean > posteriorBand(ag[a]).mean ? b : a));
    setAgendaFunding(s, lottery, 'serious');
  }
}

/** RefBot / Passive (§7.4): ~3% safety compute, AG02/AG07/AG08/AG18 at Seed, reference recipe, adopts P17. */
export const REF: Recipe = {
  name: 'RefBot', base: REFERENCE_BASE, post: REFERENCE_POST, latentAtL: 9.5,
  funding: { AG02: 'seed', AG07: 'seed', AG08: 'seed', AG18: 'seed' }, safetySplit: 0.03,
};
/** Safe-only (§7.4): 20% compute, ~25% staff, all agendas Serious and five Major, heavy safety, inoculation. */
export const SAFE: Recipe = {
  name: 'Safe-only', base: { ...REFERENCE_BASE, curation: { quality: true, hazard: true, safetyPretrain: true } },
  post: { ...REFERENCE_POST, inoculation: true, safety: 'heavy' },
  funding: Object.fromEntries(AGENDA_IDS.map((a) => [a, ['AG02', 'AG07', 'AG08', 'AG09', 'AG18'].includes(a) ? 'major' : 'serious'])) as Partial<Record<AgendaId, FundingLevel>>,
  safetySplit: 0.2, safStaff: 700, fixTechniques: true, respond: true, refresh: true,
};
/** Mixed (§7.4): AG02/07/08/09/18 at Serious + best lottery agenda, hardened graders + inoculation, visible CoT. */
export const MIXED: Recipe = {
  name: 'Mixed', base: REFERENCE_BASE, post: { ...REFERENCE_POST, inoculation: true },
  funding: { AG02: 'serious', AG07: 'serious', AG08: 'serious', AG09: 'serious', AG18: 'serious' }, safetySplit: 0.06, safStaff: 260, mixed: true,
};

export interface Outcome { mis: number; pmis: number; uAtSar?: number; lAtSar?: number; minMarginToSar: number; asiDay?: number; jsonOk: boolean }

export function play(r: Recipe, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId = 'medium', inspect?: (s: GameStateV2) => void): Outcome {
  const s = newGame(defaultSetupV2({ seed, world: 'ai2027', alignment }));
  setupRecipe(s, r);
  const emu = runEmulator(r);
  let minMargin = Infinity;
  let uAtSar: number | undefined;
  let lAtSar: number | undefined;
  while (s.time.day < 1200 && !s.ending) {
    tick(s, { extraSystems: [emu] });
    const md = s.player.milestoneDays;
    if (s.time.day % 7 === 0 && md[4] === undefined) minMargin = Math.min(minMargin, understanding(s).margin);
    if (md[4] !== undefined && uAtSar === undefined) {
      const u = understanding(s);
      uAtSar = u.U;
      lAtSar = internalVersion(s)?.evals.measuredL;
      if (stopAt === 'sar') break;
    }
    if (md[6] !== undefined) break;
  }
  inspect?.(s);
  const v = bestPlayerVersion(s);
  const mis = v ? misalignment(v.traitsTrue, v.uModes) : 0;
  return { mis, pmis: pMis(s, mis), uAtSar, lAtSar, minMarginToSar: minMargin, asiDay: s.player.milestoneDays[6], jsonOk: validateJson(s.player.safety).length === 0 && validateJson(s.player.models).length === 0 };
}
