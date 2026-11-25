// The bot game loop shared by bots.ts (the §7.4 harness) and balrun.ts (the parallel balance runner).
// One place for: the named bot policies, how a bot game is set up (Realistic actors, Rising storyteller, no tutorial) and
// how it is played to its ending.
import { engine } from '../../src/engine/v2';
import { capex2xBot } from '../../src/engine/v2/bots/capex2x';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { raceBot } from '../../src/engine/v2/bots/race';
import { makeRefBot, refBot } from '../../src/engine/v2/bots/ref';
import { DEFAULT_REF } from '../../src/engine/v2/bots/settings';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { decimalYear } from '../../src/engine/v2/core/time';
import { bestPlayerVersion } from '../../src/engine/v2/models/labs';
import { gV0, h50Of } from '../../src/engine/v2/models/capability';
import { labSpeedRel } from '../../src/engine/v2/production/production';
import { H50_V0_MIN, H80_OVER_H50 } from '../../src/data/v2/workTypes';
import { cashFloorStub, refComputeStub } from './lib';
import type { PolicyId } from './policies';
import type { AlignDiffId, BotPolicy, GameStateV2, StartType, TickOptions, WorldPresetId } from '../../src/engine/v2/types';

/** The named bot policies. */
/** 'refwide' (Stage 1): RefBot's settings plus the research ideas the rival labs pursue (balance/scans/refbot-a.json, set research-rivals-all). */
const REFWIDE = makeRefBot({ ...DEFAULT_REF, research: ['P07', 'P05', 'P08', 'rl.mlResearch', 'P17', 'P16', 'P09', 'P24', 'rl.math', 'P11', 'multimodal', 'P22'] });
const POLICIES = { race: raceBot, safe: safeBot, mixed: mixedBot, capex2x: capex2xBot, ref: refBot, refwide: REFWIDE } satisfies Record<PolicyId, BotPolicy>; // policies.ts lists the same ids
export const ALL: Record<string, BotPolicy> = POLICIES;

/** A fresh bot game: Realistic gov / public / China / rivals actors, Rising storyteller, no tutorial. */
export function newBotGame(seed: number, combo: { world: WorldPresetId; alignment: AlignDiffId }, start: StartType): GameStateV2 {
  return newGame(defaultSetupV2({ seed, ...combo, econ: combo.world === 'ai2027' ? 'ai2027' : 'sampled', storyteller: 'rising', tutorial: false, gov: 'realistic', public: 'realistic', china: 'realistic', rivals: 'realistic', start }));
}

/** Play one game with a bot until it ends (the endings system caps it at 2050-12-31). `onTick` (optional) sees the state after every tick. */
export function playBot(bot: BotPolicy, s: GameStateV2, onTick?: (s: GameStateV2) => void): GameStateV2 {
  let guard = 0;
  while (!s.ending && guard++ < 40000) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s);
    onTick?.(s);
  }
  return s;
}

// ───────────────────────────── Stage 1 forced runs ─────────────────────────────
/** One yearly sample of a forced game (balrun GameRecord.series): arrays aligned to `year`. */
export interface ForcedSeries {
  year: number[]; G: (number | null)[]; h50: (number | null)[]; h80: (number | null)[]; spd: (number | null)[]; ec: (number | null)[]; comp: number[]; staff: number[];
}
const sig3 = (x: number) => (!Number.isFinite(x) ? null : x === 0 ? 0 : Number(x.toPrecision(3)));
const fix3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/**
 * A forced game (balrun --forced): the player's lab on the prescribed compute and staff paths (forcedInputs.ts installs the
 * FORCING hooks before any game module runs), the T1 compute stub, cash never below its 1e6 start (as refGame/runRef), the
 * endings system skipped so the game runs to decimal year `until` (default 2060; endings.ts would end it at 2051 or at the
 * first ASI). One sample at 2025.5 and at every later whole year: G and h50 of the player's best model, h80 = h50/5,
 * research speed-up (labSpeedRel), effective compute (G − G at V0, OOM), computeOnline and capabilities staff. A non-finite
 * value (the capability runaway overflowing) is stored as null.
 *
 * The game also stops `POST_ASI_YEARS` years after the player's ASI: the open-loop runaway then has G in the hundreds of OOM
 * and a tick costs minutes, and nothing after it is compared. A game that never reaches ASI runs to `until`.
 */
export const POST_ASI_YEARS = 1;
export function playForced(bot: BotPolicy, s: GameStateV2, until = 2060): ForcedSeries {
  s.player.finance.cash = 1e6;
  const opts: TickOptions = { extraSystems: [refComputeStub, cashFloorStub], skip: ['endings'] };
  const out: ForcedSeries = { year: [], G: [], h50: [], h80: [], spd: [], ec: [], comp: [], staff: [] };
  const w = s.hidden.timeline;
  let next = 2025.5;
  const sample = () => {
    const v = bestPlayerVersion(s);
    const g = v?.G ?? gV0(w);
    const h50 = v ? h50Of(w, v) : H50_V0_MIN;
    out.year.push(next);
    out.G.push(fix3(g));
    out.h50.push(sig3(h50));
    out.h80.push(sig3(h50 * H80_OVER_H50));
    out.spd.push(sig3(labSpeedRel(s)));
    out.ec.push(fix3(g - gV0(w)));
    out.comp.push(Math.round(s.player.computeOnline));
    out.staff.push(Math.round(s.player.staff.cap));
    next = next === 2025.5 ? 2026 : next + 1;
  };
  let guard = 0; // the first sample comes after the first tick, once the stub has set the compute
  let stopAt = until;
  while (decimalYear(s) < stopAt && guard++ < 20000) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s, opts);
    if (decimalYear(s) >= next - 1e-9) sample();
    const asi = s.player.milestoneDays[6];
    if (asi !== undefined && POST_ASI_YEARS > 0) stopAt = Math.min(until, decimalYear(s, asi) + POST_ASI_YEARS);
  }
  return out;
}
