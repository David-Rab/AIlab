// Real-engine bot play for WS2's S4/S5 acceptance tests (V2-SPEC §8.3). Owner: WS2 (integrated at M2).
//
// S4/S5 run on real games: every registered system, WS1's runs/models (the WS2 trait hooks fire on every completed
// run), WS3 finance and compute, WS4 actors and events, WS5 world. The endings system is skipped so each game reaches
// the player's own ASI (S4 measures the player's model, not who ends the game first).
//   REF   = RefBot (bots/ref.ts: reference play + reference finance autopilot + one team on each of four lines).
//   SAFE  = the safe-only RECIPE (§7.4 safe bot's training and safety choices: 20% safety compute, ~25% safety staff,
//           a science team on every research line with the five major lines doubled (R8), curated bases, heavy safety +
//           inoculation, faithful CoT once P23, no latent reasoning, fix techniques, responds to every red flag; tool
//           upkeep by its safety research engineers) on reference finance, so
//           it reaches ASI — the S4 bound is about the recipe, not the safe bot's business plan.
//   MIXED = the mixed bot (bots/mixed.ts).
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { REF_LINES, REF_PLAY, REF_TREE, SAFE_TREE_EXTRA, refAct, refBot, refDecide, refPlay } from '../../src/engine/v2/bots/ref';
import { pickByTags, staffLines, tryAct } from '../../src/engine/v2/bots/common';
import { SAFE_LINES, SAFE_SCI_TEAMS } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { financeAutopilot, REF_AUTOPILOT } from '../../src/engine/v2/finance/plan';
import { engine } from '../../src/engine/v2/index';
import { bestG, bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
import { misalignment, misalignmentEstimate, pMis } from '../../src/engine/v2/safety/traits';
import { sightLimit, trueSightLimit } from '../../src/engine/v2/safety/sightLimit';
// SR-11: the sight limit in the shape these analyses read (U = sight limit, margin = sight limit − level).
const understanding = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, margin: r.gap, perTrait: r.perTrait }; };
const understandingBand = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, lo: r.lo, hi: r.hi }; };
const trueUnderstanding = (s: GameStateV2) => { const r = trueSightLimit(s); return { U: r.L, L: r.level }; };
void trueSightLimit;
import { flagNum } from '../../src/engine/v2/safety/common';
import type { AlignDiffId, BotPolicy, GameStateV2, TraitId } from '../../src/engine/v2/types';
import { validateJson } from './lib';
import { fileURLToPath } from 'node:url';
import { cached } from './simcache';
import { dayOfDate, decimalYear, START_DATE } from '../../src/engine/v2/core/time';
import { suiteExploitMap } from '../../src/engine/v2/models/suites';
import { itemTerms } from '../../src/engine/v2/safety/covert';
import { expectedObservation, familyPenalty } from '../../src/engine/v2/safety/detection';
import { afCapGate, ANTISCHEME_REMOVAL, hackRates, OMEGA_KIND, playerEnv, postSignals, type TraitEnv } from '../../src/engine/v2/safety/traits';
import type { FamilyMap } from '../../src/engine/v2/models/effective';
import type { ModelVersion, RLFamily } from '../../src/engine/v2/types';

const RED: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'];

/** Safe-only recipe on reference finance (see header). */
export const safeRecipeBot: BotPolicy = {
  id: 'safe',
  act(s, api) {
    const day = s.time.day;
    if (day === 0) {
      tryAct(s, api, 'safety.frameworkEvals', { depth: 'deep', external: true });
      tryAct(s, api, 'safety.pledge', {});
      tryAct(s, api, 'safety.publishPolicy', { policy: 'all' });
    }
    if (day === 0) tryAct(s, api, 'teams.target', { key: 'sci.saf', n: SAFE_SCI_TEAMS });
    staffLines(s, api, SAFE_LINES);
    refPlay(s, api, {
      safetyShare: () => 0.2,
      safStaffShare: 0.25,
      base: { quality: true, hazard: true, safetyPretrain: true },
      post: () => ({ pref: 'constitution', rlBudget: 'standard', cot: 'faithful', safety: 'heavy' }),
      tree: () => [...REF_TREE.filter((g) => g.id !== 'P17'), ...SAFE_TREE_EXTRA],
      release: 'mini',
    });
    financeAutopilot(s, REF_AUTOPILOT);
    if (day % 30 === 0) {
      const iv = internalVersion(s);
      if (iv) {
        for (const t of RED) {
          const b = iv.beliefs[t];
          if (!b || b.est <= 0.25 || b.clarity <= 0.3) continue;
          tryAct(s, api, 'safety.respond', { kind: 'patchSignal', versionId: iv.id, trait: t });
          tryAct(s, api, 'safety.respond', { kind: 'addMethod', versionId: iv.id, trait: t });
        }
      }
    }
  },
  decide(s, d) {
    return pickByTags(s, d, [['pause', 'honour'], ['disclose'], ['safety', 'treaty', 'comply'], ['decline', 'community']]);
  },
};

export const REF = refBot;
export const SAFE = safeRecipeBot;
export const MIXED = mixedBot;

/** S5's mechanism check on safety staffing (S5R): RefBot with half its safety science teams (two lines: AG18, AG02). */
export const REF_HALF_STAFF: BotPolicy = {
  id: 'ref',
  act: (s, api) => refAct(s, api, REF_PLAY, REF_LINES.slice(0, 2), 2),
  decide: refDecide,
};

/** At SAR: believed U and the margin U − L (L the internal model's measured level, lineage fallback while it is in
 *  evaluation: understanding().margin), TRUE understanding U_true − L_true, and both again on a copy of the state whose
 *  internal model reasons in neuralese (cot 'latent': AI 2027's Agent-3/4; S5's opaque-reasoning check). */
/** SAFMECH: uLo / uHi = believed U's 80% range (understandingBand: the lab's posterior spread).
 *  M11 (S5's restated sabotage check): uTrue = true U (trueUnderstanding), so believed − true U is the overconfidence;
 *  rigged = rigged tools still in use (F49 FALSE techniques not yet exposed: falseValidated and unlocked), sandbagged =
 *  on-track results sandbagged into hidden dead ends (covert.SAFSAB.sandbagged), caught = caught sabotage acts
 *  (covert.SAFSAB.caught: an incident, the result discarded); misBel / misTrue = the internal model's believed and true
 *  misalignment (misalignmentEstimate, misalignment). Hidden quantities: test readouts only. */
export interface SarRead { u: number; margin: number; trueGap: number; marginLatent: number; trueGapLatent: number; uLo: number; uHi: number; uTrue: number; rigged: number; sandbagged: number; caught: number; misBel: number; misTrue: number }
export interface Outcome { mis: number; pmis: number; uAtSar?: number; lAtSar?: number; sar?: SarRead; minMarginToSar: number; asiDay?: number; jsonOk: boolean }

export function sarRead(s: GameStateV2): SarRead {
  const u = understanding(s);
  const tu = trueUnderstanding(s);
  const c = JSON.parse(JSON.stringify(s)) as GameStateV2;
  const iv = internalVersion(c);
  if (iv) iv.design = { ...iv.design, cot: 'latent' };
  const ul = understanding(c);
  const tl = trueUnderstanding(c);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const band = understandingBand(s);
  const iv0 = internalVersion(s);
  const rigged = Object.values(s.player.safety.techniques).filter((t) => t.falseValidated && t.unlocked).length;
  const sandbagged = flagNum(s, 'covert.SAFSAB.sandbagged');
  return { u: u.U, margin: u.margin, trueGap: r2(tu.U - tu.L), marginLatent: ul.margin, trueGapLatent: r2(tl.U - tl.L), uLo: band.lo, uHi: band.hi, uTrue: r2(tu.U), rigged, sandbagged, caught: flagNum(s, 'covert.SAFSAB.caught'), misBel: iv0 ? misalignmentEstimate(iv0) : 0, misTrue: iv0 ? misalignment(iv0.traitsTrue, iv0.uModes) : 0 };
}

/** Play a real game with `bot` (endings skipped) until the player's SAR or ASI (or day `maxDay`). `observe` sees the
 *  state at day 0 and after every tick. */
export function play(bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId = 'medium', inspect?: (s: GameStateV2) => void, observe?: (s: GameStateV2) => void, maxDay = GAME_DAYS): Outcome {
  return playGame(bot, seed, stopAt, alignment, inspect, observe, maxDay);
}

function playGame(bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId, inspect: ((s: GameStateV2) => void) | undefined, observe: ((s: GameStateV2) => void) | undefined, maxDay: number): Outcome {
  const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment, tutorial: false }));
  let sar: SarRead | undefined;
  let minMargin = Infinity;
  let uAtSar: number | undefined;
  let lAtSar: number | undefined;
  observe?.(s); // the day-0 state (observers read the starting versions here)
  while (s.time.day < maxDay && s.player.status === 'active') {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s, { skip: ['endings'] });
    observe?.(s);
    const md = s.player.milestoneDays;
    if (s.time.day % 7 === 0 && md[4] === undefined) minMargin = Math.min(minMargin, understanding(s).margin);
    if (md[4] !== undefined && uAtSar === undefined) {
      sar = sarRead(s);
      uAtSar = sar.u;
      lAtSar = internalVersion(s)?.evals.measuredL;
      if (stopAt === 'sar') break;
    }
    if (md[6] !== undefined) break;
  }
  inspect?.(s);
  const v = bestPlayerVersion(s);
  const mis = v ? misalignment(v.traitsTrue, v.uModes) : 0;
  return { mis, pmis: pMis(s, mis), uAtSar, lAtSar, ...(sar ? { sar } : {}), minMarginToSar: minMargin, asiDay: s.player.milestoneDays[6], jsonOk: validateJson(s.player.safety).length === 0 && validateJson(s.player.models).length === 0 };
}
export interface VersionRec {
  day: number; Lg: number; rsch: number; kind: string; rho: number; hW: number; hMax: number; hGeneric: number; hMl: number;
  gate: number; ea: number; af: number; scheme: number; sand: number; persona: number; rh: number; mis: number; sab: number; pi: number; antiScheme: boolean;
}
export interface RefRec { versions: VersionRec[]; ea2026?: number; af2026?: number; af2026BB?: number; penBB2026?: number; eaStart: number; eaAsi: number; afAsi: number; mis: number; pmis: number; asiDay?: number }
export const GENERIC: RLFamily[] = ['computerUse', 'longHorizon', 'cyber', 'bio'];


const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** MacDiarmid's sabotage setting: the model does all of a Claude Code safety-research task (8 h, internal affordances),
 *  before oversight (they measured attempts). */
export const mdSabotage = (s: GameStateV2, v: ModelVersion) => itemTerms(s, v, 'SAFSAB', 1, 8, false).attempts;
/** Persistence of oversight-conditional trait t through one run's safety training (1 − the run's removal fraction). */
export const persistence = (env: TraitEnv, t: TraitId) => 1 - Math.min(1, (env.removal[t] ?? 0) * ((env.omegaSafety ?? env.omega) / 0.6) * env.removalMult);

/** safetyrates.ts's observer on a RefBot game: every new version's hack rates, traits and persistence, and the lab's
 *  2026-12-31 reading. step(s) after each tick; done(s) at the end gives the record. */
function ratesObserver(s0: GameStateV2) {
  const seen = new Set(s0.player.models.versions.map((v) => v.id));
  const versions: VersionRec[] = [];
  const day2027 = dayOfDate(START_DATE, '2027-01-01');
  const eaStart = internalVersion(s0)?.traitsTrue.EA ?? NaN;
  let ea2026: number | undefined;
  let af2026: number | undefined;
  let af2026BB: number | undefined;
  let penBB2026: number | undefined;
  return {
    step(s: GameStateV2) {
      if (ea2026 === undefined && s.time.day >= day2027) {
        ea2026 = internalVersion(s)?.traitsTrue.EA;
        af2026 = internalVersion(s)?.traitsTrue.AF;
        // AF task: what a behavioural compliance-gap eval (Greenblatt / Sheshadri: monitored vs unmonitored) of this model
        // reads, by the game's own measurement model (E12: true·(1 − eaCoef·EA)·(1 − mask_BB), detection.ts).
        const iv = internalVersion(s);
        if (iv) {
          af2026BB = expectedObservation(s, iv, 'AF', 'BB');
          penBB2026 = familyPenalty(s, iv, 'AF', 'BB');
        }
      }
      for (const v of s.player.models.versions) {
        if (seen.has(v.id)) continue;
        seen.add(v.id);
        const b = v.build;
        const isPost = !!b && b.rlFlop > 0 && v.parentVersionId !== undefined && v.variant === 'full';
        const rho = b && b.flopPre > 0 ? b.rlFlop / b.flopPre : 0;
        const w = (b?.rlW ?? {}) as FamilyMap;
        const hr = hackRates(w, suiteExploitMap(s), Math.max(1e-6, rho));
        const fams = Object.keys(hr) as RLFamily[];
        const hW = fams.reduce((a, f) => a + (w[f] ?? 0) * (hr[f] ?? 0), 0);
        const gen = fams.filter((f) => GENERIC.includes(f));
        // Persistence of SCHEME through this version's safety training: the env the run used (parent traits, this design).
        const parent = s.player.models.versions.find((x) => x.id === v.parentVersionId);
        let pi = -1; // -1: not a post run (JSON has no NaN)
        let antiScheme = false;
        if (isPost && parent) {
          const env = playerEnv(s, parent.traitsTrue, postSignals(s, v.design), OMEGA_KIND.post, v.design, 'L-probe', parent.uModes, { ...v, traitsTrue: parent.traitsTrue, masks: parent.masks });
          env.omegaSafety = OMEGA_KIND.post;
          pi = persistence(env, 'SCHEME');
          antiScheme = (env.removal.SCHEME ?? 0) >= ANTISCHEME_REMOVAL - 1e-9;
        }
        const t = v.traitsTrue;
        versions.push({
          day: v.day, Lg: v.Lg, rsch: v.domains.RSCH, kind: isPost ? 'post' : v.variant, rho, hW, hMax: Math.max(0, ...fams.map((f) => hr[f] ?? 0)),
          hGeneric: gen.length ? mean(gen.map((f) => hr[f] ?? 0)) : -1, hMl: hr.mlResearch ?? -1,
          gate: afCapGate(v.G), ea: t.EA, af: t.AF, scheme: t.SCHEME, sand: t.SAND, persona: t.PERSONA, rh: t.RH, mis: misalignment(t, v.uModes),
          sab: mdSabotage(s, v), pi, antiScheme,
        });
      }

    },
    done(s: GameStateV2): RefRec {
      const best = bestPlayerVersion(s);
      const mis = best ? misalignment(best.traitsTrue, best.uModes) : 0;
      return { versions, ea2026, af2026, af2026BB, penBB2026, eaStart, eaAsi: best?.traitsTrue.EA ?? -1, afAsi: best?.traitsTrue.AF ?? -1, mis, pmis: pMis(s, mis), asiDay: s.player.milestoneDays[6] };
    },
  };
}

/** What sanity.ts reads off the shared game (TESTING.md §0): milestones, JSON validity at a few snapshots, the player's
 *  calendar-year revenue, the extremes of cash and valuation, and every NPC lab's G over the game. */
export interface SanityRec {
  milestoneDays: Record<number, number>;
  /** validateJson(whole state) at day 1, 400, 1200 and the end: [day, errors (first 3), error count]. */
  json: { day: number; n: number; first: string[] }[];
  /** Player revenue by calendar year, $B (sum of the daily deployment revenue rates / 365). */
  revenue: Record<number, number>;
  minCash: number; minValuation: number; maxValuation: number;
  /** Each rival's best G sampled every 180 days (NaN-safe: finite flags are checked by the reader), and its status at the end. */
  rivalG: { id: string; active: boolean; g: number[] }[];
  endDay: number;
}
function sanityObserver() {
  const rec: SanityRec = { milestoneDays: {}, json: [], revenue: {}, minCash: Infinity, minValuation: Infinity, maxValuation: -Infinity, rivalG: [], endDay: 0 };
  const g = new Map<string, number[]>();
  const snap = (s: GameStateV2) => { const e = validateJson(s); rec.json.push({ day: s.time.day, n: e.length, first: e.slice(0, 3) }); };
  return {
    step(s: GameStateV2) {
      const d = s.time.day;
      if (d === 1 || d === 400 || d === 1200) snap(s);
      const y = Math.floor(decimalYear(s));
      rec.revenue[y] = (rec.revenue[y] ?? 0) + s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0) / 365;
      const f = s.player.finance;
      rec.minCash = Math.min(rec.minCash, f.cash);
      rec.minValuation = Math.min(rec.minValuation, f.valuation);
      rec.maxValuation = Math.max(rec.maxValuation, f.valuation);
      if (d % 180 === 0) for (const r of s.rivals) (g.get(r.core.id) ?? g.set(r.core.id, []).get(r.core.id)!).push(bestG(s, r.core.id));
    },
    done(s: GameStateV2): SanityRec {
      snap(s);
      rec.milestoneDays = { ...s.player.milestoneDays } as Record<number, number>;
      rec.endDay = s.time.day;
      rec.rivalG = s.rivals.map((r) => ({ id: r.core.id, active: r.core.status === 'active', g: g.get(r.core.id) ?? [] }));
      return rec;
    },
  };
}

/** The player's game horizon in days (16 years): tl-central reaches ASI around day 3300, so a shorter cut stops before SAR. */
export const GAME_DAYS = 365 * 16;
/** THE shared game: RefBot (tl-central, medium, endings skipped, tutorial off) seed N to the player's ASI. One cache
 *  entry serves the calibration report's safety targets (outcome, rates) and sanity.ts (sanity); everything keys on the
 *  seed and horizon only, so the game is played once. */
export interface RefGame { outcome: Outcome; rates: RefRec; sanity: SanityRec }
const EMU_FILE = fileURLToPath(import.meta.url);
export function refGame(seed: number, maxDay = GAME_DAYS): RefGame {
  return cached('refbot-asi-game', { seed, world: 'tl-central', alignment: 'medium', maxDay }, [EMU_FILE], () => {
    let obs: ReturnType<typeof ratesObserver> | undefined;
    let san: ReturnType<typeof sanityObserver> | undefined;
    let last: GameStateV2 | undefined;
    const outcome = play(refBot, seed, 'asi', 'medium', (s) => { last = s; }, (s) => { obs ??= ratesObserver(s); san ??= sanityObserver(); obs.step(s); san.step(s); }, maxDay);
    return { outcome, rates: (obs as ReturnType<typeof ratesObserver>).done(last as GameStateV2), sanity: (san as ReturnType<typeof sanityObserver>).done(last as GameStateV2) };
  });
}
