// Shared bot helpers (§7.4). Owner: WS4 (harness); balance owned by all workstreams.
//
// Bots act only through EngineApi actions (never by writing state) and decide by choice TAGS, so they keep working
// as other workstreams add actions and events. All bots share WS1's reference model cadence (`refPlay`) and WS3's
// finance autopilot with their own options.
import { ACTION_BY_ID, EVENT_BY_ID } from '../core/registry';
import type { EngineApi, GameStateV2, PendingDecision } from '../types';

type Params = Record<string, number | string | boolean>;

/** Try an action by id; returns true if it applied. Unknown or unavailable actions are skipped silently. */
export function tryAct(s: GameStateV2, api: EngineApi, id: string, params: Params = {}): boolean {
  const a = ACTION_BY_ID.get(id);
  if (!a || a.available(s) !== true) return false;
  try {
    api.act(s, id, params);
    return true;
  } catch {
    return false;
  }
}

/** Intent → registered action ids in other spheres (first registered one is used). Model cadence, compute and money
 *  are shared policies instead: WS1's `refPlay` (bots/ref.ts) and WS3's `financeAutopilot` (finance/plan.ts). */
export const BOT_INTENTS: Record<string, string[]> = {
  fundAgenda: ['safety.fund'], // params { agenda, level: off | seed | serious | major }
  evalGate: ['safety.evalGate'], // params { level: none | basic | full | fullPlusExternal }
  raise: ['fin.raise'],
  split: ['setSplit'], // params: ComputeSplit keys (must sum to 1)
  release: ['deploy'], // params { versionId, channel }
};

export function intent(s: GameStateV2, api: EngineApi, name: keyof typeof BOT_INTENTS, params: Params = {}): boolean {
  for (const id of BOT_INTENTS[name]) if (ACTION_BY_ID.has(id)) return tryAct(s, api, id, params);
  return false;
}

/** Choose the first available choice whose tags hit the earliest preference group; else the event's default. */
export function pickByTags(s: GameStateV2, d: PendingDecision, prefs: string[][]): number {
  const def = EVENT_BY_ID.get(d.id);
  if (!def) return 0;
  const ok = (i: number) => (def.choices[i].available?.(s) ?? true) === true;
  for (const group of prefs) {
    const i = def.choices.findIndex((c, k) => ok(k) && c.tags.some((t) => group.includes(t)));
    if (i >= 0) return i;
  }
  return ok(def.defaultChoice) ? def.defaultChoice : 0;
}

/** Index of a choice by label (falls back to `fallback`). */
export function byLabel(d: PendingDecision, label: string, fallback = 0): number {
  const i = EVENT_BY_ID.get(d.id)?.choices.findIndex((c) => c.label === label) ?? -1;
  return i >= 0 ? i : fallback;
}

/** Run an action at most every `every` days (uses the action's own cooldown/once rules too). */
export const every = (s: GameStateV2, n: number, offset = 0) => (s.time.day + offset) % n === 0;
