// Readout sweep (model v3 G1): call every UI-facing selector on a state, for the purity checks in hygiene.ts. Owner: WS1.
//
// "Selectors are the only path for the UI" (V2-SPEC §2.1), so a selector must be a pure function of the state: it may
// not write the state, consume a random stream, or leave a cache behind that a later tick reads differently. The sweep
// calls every function the engine's public entry point exports (src/engine/v2/index.ts: what src/ui/v2 imports) and the
// worldfx readouts the test scripts read, each with the state alone and, for two-argument functions, with each of a small
// set of typical second arguments (a version, a product, a lab, a team, a sector, a region, ...). Throws are caught: a
// selector given the wrong kind of argument may throw, and that is not what the checks look for.
//
//   readSweep(s, light?)  → { calls, fails }: every call made (light: five typical second arguments instead of all 16, ~half the CPU); `fails` = the calls that threw a write to a frozen object
//                           (only meaningful on a deep-frozen state: deepFreeze)
//   deepFreeze(x)         freezes x and everything under it (a write then throws in strict-mode code: ES modules)
import * as E from '../../src/engine/v2/index';
import * as R from '../../src/engine/v2/worldfx/readouts';
import { bestPublicOf, worldMix } from '../../src/engine/v2/worldfx/mix';
import { labMarketRevenue, revenueReadout, servingPool, idleServing } from '../../src/engine/v2/worldfx/revenue';
import type { GameStateV2 } from '../../src/engine/v2/types';

/** Exports that change the game or build a new one: never called by the sweep. */
const MUTATORS = new Set(['act', 'resolve', 'tick', 'newGame', 'deserialize', 'defaultSetupV2']);

type Fn = (...a: unknown[]) => unknown;
/** The functions swept: name → function (engine index first, then the worldfx readouts and market reads). */
export function sweptFunctions(): [string, Fn][] {
  const out: [string, Fn][] = [];
  const seen = new Set<Fn>();
  const add = (name: string, f: unknown) => {
    if (typeof f !== 'function' || MUTATORS.has(name) || seen.has(f as Fn)) return;
    seen.add(f as Fn);
    out.push([name, f as Fn]);
  };
  for (const [k, v] of Object.entries(E)) add(k, v);
  for (const [k, v] of Object.entries(R)) add(k, v);
  for (const [k, v] of Object.entries({ worldMix, bestPublicOf, labMarketRevenue, revenueReadout, servingPool, idleServing })) add(k, v);
  return out;
}

/** Typical second arguments for two-argument selectors, from the state. */
function secondArgs(s: GameStateV2, light: boolean): unknown[] {
  const v = E.internalVersion(s);
  const dep = s.player.deployments.find((d) => d.channel !== 'internal') ?? s.player.deployments[0];
  const team = s.player.teams[0];
  const rival = s.rivals[0];
  const xs: unknown[] = [v, v?.id, dep, dep?.id, 'player', rival?.core.id, team, team?.id, 'SOFT', 'US', 'AG01', 'capFrontier', 'SWE', 'ai2027', 0.5, true];
  const all = xs.filter((x) => x !== undefined);
  return light ? [v, dep, 'player', rival?.core.id, 0.5].filter((x) => x !== undefined) : all;
}

const FROZEN_WRITE = /read[- ]only|not extensible|Cannot (add|assign|delete|define)|object is not extensible|frozen/i;

export interface SweepResult { calls: number; fails: string[] }
/** Call every swept selector on `s` (see the header). */
export function readSweep(s: GameStateV2, light = false): SweepResult {
  const fails: string[] = [];
  let calls = 0;
  const args2 = secondArgs(s, light);
  const call = (name: string, f: Fn, args: unknown[]) => {
    calls++;
    try {
      f(...args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (FROZEN_WRITE.test(msg)) fails.push(`${name}(${args.length - 1} arg): ${msg.slice(0, 120)}`);
    }
  };
  for (const [name, f] of sweptFunctions()) {
    call(name, f, [s]);
    if (f.length >= 2) for (const a of args2) call(name, f, [s, a]);
  }
  return { calls, fails: [...new Set(fails)] };
}

/** Deep-freeze a plain object graph (in place; returns it). */
export function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const k of Object.keys(x)) deepFreeze((x as Record<string, unknown>)[k]);
  }
  return x;
}
