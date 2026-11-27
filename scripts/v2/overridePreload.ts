// Node --import preload for balrun workers: applies the override set in env BAL_OVERRIDES (JSON) before balrun's own
// imports run, so the game modules never see the unmodified values. BAL_FORCED (balrun --forced) installs the Stage 1
// forced input paths (forcedInputs.ts) the same way.
import { applyOverrides } from './paramOverride';
if (process.env.BAL_OVERRIDES) await applyOverrides(JSON.parse(process.env.BAL_OVERRIDES));
if (process.env.BAL_FORCED) (await import('./forcedInputs')).installForced(process.env.BAL_FORCED);
