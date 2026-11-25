// The bot policy ids, without importing the engine (balrun's parent process lists them and must not load the game).
// botgame.ts types its `ALL` table by this list, so the two cannot drift apart.
export const POLICY_IDS = ['race', 'safe', 'mixed', 'capex2x', 'ref', 'refwide'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];
