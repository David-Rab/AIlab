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
import { COVERT_ACTS } from '../../src/data/v2/danger';
import { pickByTags, staffLines, tryAct } from '../../src/engine/v2/bots/common';
import { SAFE_LINES, SAFE_SCI_TEAMS } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { financeAutopilot, REF_AUTOPILOT } from '../../src/engine/v2/finance/plan';
import { engine } from '../../src/engine/v2/index';
import { bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
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

const RED: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'];

/** Safe-only recipe on reference finance (see header). */
export const safeRecipeBot: BotPolicy = {
  id: 'safe',
  act(s, api) {
    const day = s.time.day;
    if (day === 0) {
      tryAct(s, api, 'safety.evalGate', { level: 'fullPlusExternal' });
      tryAct(s, api, 'safety.pledge', {});
      tryAct(s, api, 'safety.publishPolicy', { policy: 'all' });
    }
    if (day === 0) tryAct(s, api, 'teams.target', { key: 'sci.saf', n: SAFE_SCI_TEAMS });
    staffLines(s, api, SAFE_LINES);
    refPlay(s, api, {
      safetyShare: () => 0.2,
      safStaffShare: 0.25,
      base: { quality: true, hazard: true, safetyPretrain: true },
      post: () => ({ pref: 'constitution', rlBudget: 'standard', cot: 'faithful', safety: 'heavy', inoculation: true }),
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
          tryAct(s, api, 'safety.respond', { kind: 'targetedTraining', versionId: iv.id, trait: t });
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

/** S5's sabotage check (S5R): RefBot with all safety work handed to AI (Trusted to AI 100%). RefBot's own F5 policy
 *  hands little (≈ 10% at SAR: it withdraws trust as believed sabotage rises), so sabotage of safety research barely
 *  reaches its lines; AI 2027's lab put Agent-3 "in charge of testing Agent-4's alignment". */
export const REF_TRUSTED: BotPolicy = {
  id: 'ref',
  act: (s, api) => {
    refAct(s, api);
    if (s.player.policies.trustedToAI !== 1) tryAct(s, api, 'agents.trusted', { share: 1 });
  },
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

function sarRead(s: GameStateV2): SarRead {
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

/** Play a real game with `bot` (endings skipped) until the player's SAR or ASI. `sabotage` scales the safety-research
 *  sabotage act's rate (COVERT_ACTS.SAFSAB κ) for this game only (S5's sabotage check). */
export function play(bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId = 'medium', inspect?: (s: GameStateV2) => void, sabotage = 1): Outcome {
  const k0 = COVERT_ACTS.SAFSAB.kappa;
  COVERT_ACTS.SAFSAB.kappa = k0 * sabotage;
  try {
    return playGame(bot, seed, stopAt, alignment, inspect);
  } finally {
    COVERT_ACTS.SAFSAB.kappa = k0;
  }
}

function playGame(bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId, inspect?: (s: GameStateV2) => void): Outcome {
  const s = newGame(defaultSetupV2({ seed, world: 'ai2027', alignment, tutorial: false }));
  let sar: SarRead | undefined;
  let minMargin = Infinity;
  let uAtSar: number | undefined;
  let lAtSar: number | undefined;
  while (s.time.day < 1600 && s.player.status === 'active') {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s, { skip: ['endings'] });
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
