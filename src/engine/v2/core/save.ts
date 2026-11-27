// Save format, migrations, state hash (V2-SPEC §2.5). Owner: WS1.
import type { GameStateV2 } from '../types';

/** Bump on any breaking change to types.ts and add a migration from the previous rev to `migrations`.
 *  Saves below MIN_SCHEMA_REV do not load: deserialize refuses them with OLD_SAVE_MESSAGE. Each clean save break
 *  (UB-3 at 103, the timelines at 112, the data-centre redesign at 113) sets MIN_SCHEMA_REV = SCHEMA_REV and deletes
 *  every migration below it with the helpers only they used; the history of each is in git.
 */
// 113: the data-centre redesign (master); old saves invalid, no migration.
// 114: labour round (market, pools, stars, team sizes, no tiers); old saves invalid, no migration (MIN_SCHEMA_REV = 114).
// 115: teams are whole chunks (hiring.progress replaces hiring.filling); old saves invalid, no migration.
export const SCHEMA_REV = 115;
/** The oldest save that loads (DD-20, UB-3): a save below it is refused with OLD_SAVE_MESSAGE. */
export const MIN_SCHEMA_REV = 115;
/** What the player is told when a save is older than MIN_SCHEMA_REV. */
export const OLD_SAVE_MESSAGE = 'This save is from an older version of the game and can no longer be loaded.';
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

/** migrations[rev] upgrades a state at schemaRev = rev to rev + 1 (from MIN_SCHEMA_REV up). None while MIN_SCHEMA_REV = SCHEMA_REV. */
export const migrations: Record<number, (s: Record<string, unknown>) => void> = {};

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  let rev = Number(raw.schemaRev ?? 0);
  if (!(rev >= MIN_SCHEMA_REV)) throw new Error(OLD_SAVE_MESSAGE);
  if (rev > SCHEMA_REV) throw new Error(`save is from a newer build (schemaRev ${rev} > ${SCHEMA_REV})`);
  while (rev < SCHEMA_REV) {
    const m = migrations[rev];
    if (!m) throw new Error(`no migration from schemaRev ${rev}`);
    m(raw);
    rev++;
    raw.schemaRev = rev;
  }
  return raw as unknown as GameStateV2;
}

/** 64-bit (two FNV-1a 32 lanes) hex hash of the serialised state. Determinism tests compare these. */
export function hashString(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(s: GameStateV2): string {
  return hashString(serialize(s));
}
