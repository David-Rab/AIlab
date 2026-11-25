// Node --import preload for balrun workers: applies the override set in env BAL_OVERRIDES (JSON) before balrun's own
// imports run, so the game modules never see the unmodified values.
import { applyOverrides } from './paramOverride';
if (process.env.BAL_OVERRIDES) await applyOverrides(JSON.parse(process.env.BAL_OVERRIDES));
