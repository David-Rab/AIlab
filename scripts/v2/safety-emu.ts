// Real-engine bot play for WS2's S4/S5 acceptance tests (V2-SPEC §8.3). Owner: WS2 (integrated at M2).
//
// S4/S5 run on real games: every registered system, WS1's runs/models (the WS2 trait hooks fire on every completed
// run), WS3 finance and compute, WS4 actors and events, WS5 world. The endings system is skipped so each game reaches
// the player's own ASI (S4 measures the player's model, not who ends the game first).
//   REF   = RefBot (bots/ref.ts: reference play + reference finance autopilot + Seed agendas).
//   SAFE  = the safe-only RECIPE (§7.4 safe bot's training and safety choices: 20% safety compute, ~25% safety staff,
//           all agendas Serious / five Major, curated bases, heavy safety + inoculation, faithful CoT once P23, no latent
//           reasoning, fix techniques, responds to every red flag, re-validates decaying tools) on reference finance, so
//           it reaches ASI — the S4 bound is about the recipe, not the safe bot's business plan.
//   MIXED = the mixed bot (bots/mixed.ts).
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { REF_PARADIGMS, refBot, refPlay } from '../../src/engine/v2/bots/ref';
import { pickByTags, tryAct } from '../../src/engine/v2/bots/common';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { financeAutopilot, REF_AUTOPILOT } from '../../src/engine/v2/finance/plan';
import { engine } from '../../src/engine/v2/index';
import { bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
import { mAtLevel } from '../../src/engine/v2/safety/common';
import { decayAt } from '../../src/engine/v2/safety/techniques';
import { misalignment, pMis } from '../../src/engine/v2/safety/traits';
import { understanding } from '../../src/engine/v2/safety/understanding';
import type { AlignDiffId, BotPolicy, GameStateV2, TraitId } from '../../src/engine/v2/types';
import { validateJson } from './lib';

const FIX = ['T-PERSONA', 'T-ANTISCHEME', 'T-CONFESS', 'T-CAST', 'T-W2S'];
const RED: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'];
const MAJOR = ['AG02', 'AG07', 'AG08', 'AG09', 'AG18'];

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
    if (day % 182 === 0) for (const a of AGENDA_IDS) tryAct(s, api, 'safety.fund', { agenda: a, level: MAJOR.includes(a) ? 'major' : 'serious' });
    refPlay(s, api, {
      safetyShare: () => 0.2,
      safStaffShare: 0.25,
      base: { quality: true, hazard: true, safetyPretrain: true },
      post: () => ({ pref: 'constitution', rlIntensity: 'heavyHardened', cot: 'faithful', safety: 'heavy', inoculation: true }),
      paradigms: () => [...REF_PARADIGMS.filter((p) => p !== 'P17'), 'P23'],
    });
    financeAutopilot(s, REF_AUTOPILOT);
    if (day % 30 === 0) {
      for (const id of FIX) if (s.player.safety.techniques[id]?.unlocked && !s.player.safety.techniques[id].active) tryAct(s, api, 'safety.technique', { id });
      const iv = internalVersion(s);
      if (iv) {
        for (const t of RED) {
          const b = iv.beliefs[t];
          if (!b || b.est <= 0.25 || b.clarity <= 0.3) continue;
          tryAct(s, api, 'safety.respond', { kind: 'patchSignal', versionId: iv.id, trait: t });
          tryAct(s, api, 'safety.respond', { kind: 'targetedTraining', versionId: iv.id, trait: t });
        }
        const M = mAtLevel(s.hidden.timeline, iv.evals.measuredL ?? 0);
        for (const t of Object.values(s.player.safety.techniques)) if (t.unlocked && t.active && t.k > 0 && decayAt(s, t, M * 10, false) < 0.8) tryAct(s, api, 'safety.refresh', { techniqueId: t.id });
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

export interface Outcome { mis: number; pmis: number; uAtSar?: number; lAtSar?: number; minMarginToSar: number; asiDay?: number; jsonOk: boolean }

/** Play a real game with `bot` (endings skipped) until the player's SAR or ASI. */
export function play(bot: BotPolicy, seed: number, stopAt: 'asi' | 'sar', alignment: AlignDiffId = 'medium', inspect?: (s: GameStateV2) => void): Outcome {
  const s = newGame(defaultSetupV2({ seed, world: 'ai2027', alignment, tutorial: false }));
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
