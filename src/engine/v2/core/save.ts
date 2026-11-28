// Save format, state hash (V2-SPEC §2.5). Owner: WS1.
import type { GameStateV2 } from '../types';

/** Bump on any breaking change to types.ts. Saves are never migrated (the clean save break, UB-3 and N12): a save below
 *  MIN_SCHEMA_REV does not load and deserialize refuses it with OLD_SAVE_MESSAGE; MIN_SCHEMA_REV is raised to SCHEMA_REV at each
 *  break. History of the revs up to 112 is in git before N12. */
// 114 (npc): N12, the old NPC state is gone (RivalLab.phys, archetype, meters; SimpleModel traits). 113-115 (master): the
// data-centre redesign, the labour round, teams as whole chunks. 116: npc merged with master. 117: W1b, macro → the
// economy readouts. 118: W1c, the relations cluster is gone (relations, researchBodies, blocs, the relation fields of the old working-state block).
// 119: W1d, the gov, public and China actors are gone (s.gov, s.pub, china meters; setup gov/public/china).
// 121: W4, the public (s.public). 122: W5, the US government (s.usgov). 123: W6, the China government (s.chinagov;
// china.computeAbs → china.access). 124: W11b, the old working-state block is split into its owners (events.requests, player.security,
// player.actionDay, rivalIncidents, endingProgress, usgov.dpaAccepted, public.misalignLeakDay, world.gdp0, the market, npc and site fields).
// 125: weekly record series aiWork, aiIncome, robots (World tab tiles, W8b-3).
export const SCHEMA_REV = 125;
/** The oldest save that loads: a save below it is refused. */
export const MIN_SCHEMA_REV = SCHEMA_REV;
/** What the player is told when a save is older than MIN_SCHEMA_REV. */
export const OLD_SAVE_MESSAGE = 'This save is from an older version of the game and can no longer be loaded.';
export const AUTOSAVE_KEY = 'ai27.v2.autosave';
export const SLOT_KEYS = ['ai27.v2.slot1', 'ai27.v2.slot2', 'ai27.v2.slot3'] as const;
/** v1 save key: the start screen offers "v1 save found: start new" (no migration). */
export const V1_SAVE_KEY = 'ai27.save.v1';
export const SAVE_BUDGET_BYTES = 1.5 * 1024 * 1024;

export function serialize(s: GameStateV2): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameStateV2 {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw.version !== 2) throw new Error(`not a v2 save (version ${String(raw.version)})`);
  const rev = Number(raw.schemaRev ?? 0);
  if (!(rev >= MIN_SCHEMA_REV)) throw new Error(OLD_SAVE_MESSAGE);
  if (rev > SCHEMA_REV) throw new Error(`save is from a newer build (schemaRev ${rev} > ${SCHEMA_REV})`);
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
