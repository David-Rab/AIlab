// Public entry point of the v2 engine: the EngineApi object plus selectors. UI (WS6/WS7) and bots import from here.
import type { EngineApi } from './types';
import { newGame } from './core/init';
import { act, resolve, tick } from './core/loop';
import { leadDays, production, raiseCeiling, riskSources, understanding } from './core/selectors';

export const engine: EngineApi = {
  newGame,
  tick,
  act(s, actionId, params) {
    const err = act(s, actionId, params);
    if (err) throw new Error(err);
  },
  resolve(s, instance, choice) {
    const err = resolve(s, instance, choice);
    if (err) throw new Error(err);
  },
  production,
  understanding,
  riskSources,
  leadDays,
  raiseCeiling: (s) => raiseCeiling(s),
};

export { defaultSetupV2, newGame } from './core/init';
export { act, resolve, tick } from './core/loop';
export * from './core/selectors';
export { serialize, deserialize, stateHash, AUTOSAVE_KEY, SLOT_KEYS, V1_SAVE_KEY, SCHEMA_REV } from './core/save';
export type * from './types';
