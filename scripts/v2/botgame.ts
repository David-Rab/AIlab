// The bot game loop shared by bots.ts (the §7.4 harness) and balrun.ts (the parallel balance runner).
// One place for: the named bot policies, how a bot game is set up (Realistic actors, no tutorial) and
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
import { FORCING } from '../../src/engine/v2/core/forcing';
import { tryAct } from '../../src/engine/v2/bots/common';
import { roleOfKey } from '../../src/engine/v2/departments/teams';
import { LABOUR_KINDS, PREMIUM_STEPS, W0 } from '../../src/data/v2/labourMarket';
import { TEAM_KEYS, TEAM_SIZE } from '../../src/data/v2/teams';
import { bestPlayerVersion } from '../../src/engine/v2/models/labs';
import { gV0, h50Of } from '../../src/engine/v2/models/capability';
import { labSpeedRel } from '../../src/engine/v2/production/production';
import { H50_V0_MIN, H80_OVER_H50 } from '../../src/data/v2/workTypes';
import { cashFloorStub, refComputeStub } from './lib';
import { matchedSpeedup } from './matched';
import type { PolicyId } from './policies';
import type { AlignDiffId, BotPolicy, GameStateV2, StartType, TeamKey, TeamRole, TickOptions, WorldPresetId } from '../../src/engine/v2/types';

/** The named bot policies. */
/** 'refwide' (Stage 1): RefBot's settings plus the research ideas the rival labs pursue (balance/scans/refbot-a.json, set research-rivals-all). */
const REFWIDE = makeRefBot({ ...DEFAULT_REF, research: ['P07', 'P05', 'P08', 'rl.mlResearch', 'P17', 'P16', 'P09', 'P24', 'rl.math', 'P11', 'multimodal', 'P22'] });
/** 'reflines' (item D): refwide with the research lines at the top of the research list, staffed from day 0 at RefBot's counts. */
const REFLINES = makeRefBot({ ...DEFAULT_REF, linesFirst: true, research: ['P07', 'P05', 'P08', 'rl.mlResearch', 'P17', 'P16', 'P09', 'P24', 'rl.math', 'P11', 'multimodal', 'P22'] });
const POLICIES = { race: raceBot, safe: safeBot, mixed: mixedBot, capex2x: capex2xBot, ref: refBot, refwide: REFWIDE, reflines: REFLINES } satisfies Record<PolicyId, BotPolicy>; // policies.ts lists the same ids
export const ALL: Record<string, BotPolicy> = POLICIES;

/** A fresh bot game: Realistic actors, no tutorial. */
export function newBotGame(seed: number, combo: { world: WorldPresetId; alignment: AlignDiffId }, start: StartType): GameStateV2 {
  return newGame(defaultSetupV2({ seed, ...combo, tutorial: false, start }));
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
/** One sample of a forced game (balrun GameRecord.series): arrays aligned to `year`. `spd` is labSpeedRel (the player's own research speed, a readout: it carries compute and staff growth, so it is not comparable with the AIFM multiplier); `spdM` is the matched speed-up (matched.ts), the quantity the AIFM progress multiplier measures. */
export interface ForcedSeries {
  year: number[]; G: (number | null)[]; h50: (number | null)[]; h80: (number | null)[]; spd: (number | null)[]; spdM: (number | null)[]; ec: (number | null)[]; comp: number[]; staff: number[];
}
/** Forced runs hire the AIFM staff path through the labour market (L19; LABOUR-ROUND 4.4). Only what a player can do: the
 *  hiring targets ('teams.target') and the pay premium ('hiring.premium'). No engine exception. */
export const STAFF_MET = 0.97; // heads at or above this share of the path count as on the path
/** Per sample: heads, the path (start heads x staffPath), the premium step, the market wage over its start value. */
export interface KindTrack { heads: number[]; path: number[]; prem: number[]; wr: number[] }
export interface StaffLog {
  /** Heads below STAFF_MET x path at the top premium step (+100%), per kind: [year, heads, path], at most one a quarter. A finding. */
  short: Partial<Record<TeamRole, [number, number, number][]>>;
  /** The first year the path was missed at the top step, per kind. */
  firstMiss: Partial<Record<TeamRole, number>>;
  track: { year: number[]; eng: KindTrack; re: KindTrack; sci: KindTrack };
}
export interface ForcedRun { series: ForcedSeries; staff: StaffLog }
const kindHeads = (s: GameStateV2, k: TeamRole) => {
  let n = s.player.hiring.progress[k].heads; // hired toward the next team
  for (const t of s.player.teams) if (t.role === k) n += t.heads;
  return n;
};
const emptyTrack = (): KindTrack => ({ heads: [], path: [], prem: [], wr: [] });
class ForcedStaff {
  private startKey: Partial<Record<TeamKey, number>> = {};
  private startKind: Record<TeamRole, number> = { eng: 0, re: 0, sci: 0 };
  private lastShort: Partial<Record<TeamRole, number>> = {};
  log: StaffLog = { short: {}, firstMiss: {}, track: { year: [], eng: emptyTrack(), re: emptyTrack(), sci: emptyTrack() } };
  constructor(s: GameStateV2) {
    for (const k of TEAM_KEYS) {
      const role = roleOfKey(k);
      let n = 0;
      for (const t of s.player.teams) if (t.role === role && (role === 'eng' ? 'eng' : `${role}.${t.dept}`) === k) n += t.heads;
      this.startKey[k] = n;
      this.startKind[role] += n;
    }
  }
  private path(k: TeamRole, yr: number) { return this.startKind[k] * FORCING.staffPath!(yr); }
  /** Every tick, after the bot has acted: the targets are start heads x path per team kind, rounded up to whole teams. */
  targets(s: GameStateV2, api: typeof engine) {
    const sp = FORCING.staffPath!(decimalYear(s));
    for (const k of TEAM_KEYS) {
      const n = Math.ceil(((this.startKey[k] ?? 0) * sp) / TEAM_SIZE[roleOfKey(k)] - 1e-9);
      if ((s.player.hiring.targets[k] ?? 0) !== n) tryAct(s, api, 'teams.target', { key: k, n });
    }
  }
  /** Weekly: one premium step up while heads < 97% of the path, one step down while above it; log a miss at the top step. */
  weekly(s: GameStateV2, api: typeof engine) {
    const yr = decimalYear(s);
    for (const k of LABOUR_KINDS) {
      const heads = kindHeads(s, k), path = this.path(k, yr);
      if (path <= 0) continue;
      const cur = Math.max(0, PREMIUM_STEPS.findIndex((x) => Math.abs(x - (s.player.hiring.premium?.[k] ?? 0)) < 1e-9));
      const top = PREMIUM_STEPS.length - 1;
      const want = heads < STAFF_MET * path ? Math.min(top, cur + 1) : heads > path ? Math.max(0, cur - 1) : cur;
      if (want !== cur) tryAct(s, api, 'hiring.premium', { kind: k, step: PREMIUM_STEPS[want] });
      if (cur === top && heads < STAFF_MET * path) {
        if (this.log.firstMiss[k] === undefined) this.log.firstMiss[k] = Number(yr.toFixed(3));
        if (this.lastShort[k] === undefined || yr - this.lastShort[k]! >= 0.25) {
          this.lastShort[k] = yr;
          (this.log.short[k] ??= []).push([Number(yr.toFixed(3)), Math.round(heads), Math.round(path)]);
        }
      }
    }
  }
  sample(s: GameStateV2, year: number) {
    const tr = this.log.track;
    tr.year.push(year);
    for (const k of LABOUR_KINDS) {
      const o = tr[k];
      o.heads.push(Math.round(kindHeads(s, k)));
      o.path.push(Math.round(this.path(k, decimalYear(s))));
      o.prem.push(s.player.hiring.premium?.[k] ?? 0);
      o.wr.push(Number((s.labour.pools[k].w / W0[k]).toFixed(3)));
    }
  }
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
 * The game ends on the day the player reaches ASI (milestoneDays[6]), after one last sample on that day (its true date, off the
 * quarterly grid unless a grid sample was taken that tick): the open-loop runaway after ASI has G in the hundreds of OOM and a tick
 * costs minutes, and the scoring (calibscore.ts: milestones, intervals, series read at a date or at SC + tau) takes a date past the
 * last sample as the last sample, a lower bound flagged '*'. A game that never reaches ASI runs to `until` (2060) or the 20000-tick guard.
 */
/** Years between samples after 2026 (R3.2: a quarter, so a date relative to SC or AC (SC+0.5 y) falls between samples a quarter apart, not a year). The first two samples stay 2025.5 and 2026. */
export const SAMPLE_STEP = 0.25;
export interface ForcedOpts { step?: number; spdM?: boolean }
export function playForced(bot: BotPolicy, s: GameStateV2, until = 2060, o: ForcedOpts = {}): ForcedRun {
  const step = o.step ?? SAMPLE_STEP, withM = o.spdM ?? true;
  const M = matchedSpeedup();
  s.player.finance.cash = 1e6;
  const opts: TickOptions = { extraSystems: [refComputeStub, cashFloorStub], skip: ['endings'] };
  const staff = new ForcedStaff(s);
  const out: ForcedSeries = { year: [], G: [], h50: [], h80: [], spd: [], spdM: [], ec: [], comp: [], staff: [] };
  const w = s.hidden.timeline;
  let next = 2025.5;
  const sample = (at = next) => {
    const v = bestPlayerVersion(s);
    const g = v?.G ?? gV0(w);
    const h50 = v ? h50Of(w, v) : H50_V0_MIN;
    out.year.push(at);
    out.G.push(fix3(g));
    out.h50.push(sig3(h50));
    out.h80.push(sig3(h50 * H80_OVER_H50));
    out.spd.push(sig3(labSpeedRel(s)));
    if (withM) { const m = M.read(s); out.spdM.push(m === null ? null : sig3(m)); } else out.spdM.push(null);
    out.ec.push(fix3(g - gV0(w)));
    out.comp.push(Math.round(s.player.computeOnline));
    out.staff.push(Math.round(s.player.staff.cap));
    staff.sample(s, at);
  };
  let guard = 0; // the first sample comes after the first tick, once the stub has set the compute
  while (decimalYear(s) < until && guard++ < 20000) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    staff.targets(s, engine);
    if (s.time.day % 7 === 0) staff.weekly(s, engine);
    tick(s, opts);
    if (withM) M.observe(s);
    let sampled = false;
    if (decimalYear(s) >= next - 1e-9) { sample(); sampled = true; next = next === 2025.5 ? 2026 : next + step; }
    if (s.player.milestoneDays[6] !== undefined) { // ASI: the last sample, on this day, then the game ends
      if (!sampled) sample(decimalYear(s));
      break;
    }
  }
  return { series: out, staff: staff.log };
}
